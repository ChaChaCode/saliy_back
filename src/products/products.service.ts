import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  FilterProductsDto,
} from './products.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== CRUD ОПЕРАЦИИ ====================

  /**
   * Создать товар
   */
  async createProduct(dto: CreateProductDto) {
    const { categoryIds, ...productData } = dto;

    // Проверяем уникальность slug
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException(`Товар с slug "${dto.slug}" уже существует`);
    }

    // Создаём товар со связями с категориями
    const product = await this.prisma.product.create({
      data: {
        ...productData,
        ...(categoryIds && {
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    this.logger.log(
      `Товар создан: ID=${product.id}, slug="${product.slug}", name="${product.name}", price=${product.price}`,
    );

    return product;
  }

  /**
   * Получить товар по ID
   */
  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Товар с ID ${id} не найден`);
    }

    return product;
  }

  /**
   * Получить товар по slug
   */
  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Товар "${slug}" не найден`);
    }

    // Увеличиваем счётчик просмотров
    await this.incrementViewCount(product.id);

    return product;
  }

  /**
   * Обновить товар
   */
  async updateProduct(id: number, dto: UpdateProductDto) {
    // Проверяем существование
    const oldProduct = await this.getProductById(id);

    const { categoryIds, ...productData } = dto;

    // Если slug изменился, проверяем уникальность
    if (dto.slug) {
      const existing = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException(`Товар с slug "${dto.slug}" уже существует`);
      }
    }

    // Обновляем товар
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(categoryIds && {
          categories: {
            deleteMany: {}, // Удаляем старые связи
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    // Логируем изменения
    const changes: string[] = [];
    if (dto.name && dto.name !== oldProduct.name) {
      changes.push(`name: "${oldProduct.name}" → "${dto.name}"`);
    }
    if (dto.price !== undefined && dto.price !== oldProduct.price) {
      changes.push(`price: ${oldProduct.price} → ${dto.price}`);
    }
    if (dto.discount !== undefined && dto.discount !== oldProduct.discount) {
      changes.push(`discount: ${oldProduct.discount}% → ${dto.discount}%`);
    }
    if (dto.isActive !== undefined && dto.isActive !== oldProduct.isActive) {
      changes.push(`isActive: ${oldProduct.isActive} → ${dto.isActive}`);
    }

    if (changes.length > 0) {
      this.logger.log(
        `Товар обновлён: ID=${id}, slug="${product.slug}", изменения: ${changes.join(', ')}`,
      );
    }

    return product;
  }

  /**
   * Удалить товар
   */
  async deleteProduct(id: number) {
    // Проверяем существование
    const product = await this.getProductById(id);

    const result = await this.prisma.product.delete({
      where: { id },
    });

    this.logger.warn(
      `Товар удалён: ID=${id}, slug="${product.slug}", name="${product.name}"`,
    );

    return result;
  }

  // ==================== ПОЛУЧЕНИЕ ТОВАРОВ ====================

  /**
   * Получить список товаров с фильтрацией
   */
  async getProducts(filters: FilterProductsDto = {}) {
    const {
      categorySlug,
      gender,
      status,
      minPrice,
      maxPrice,
      inStock,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
    } = filters;

    // Строим WHERE условие
    const where: any = {
      isActive: true,
    };

    // Фильтр по категории
    if (categorySlug) {
      where.categories = {
        some: {
          category: {
            slug: categorySlug,
          },
        },
      };
    }

    // Фильтр по полу
    if (gender) {
      where.gender = gender;
    }

    // Фильтр по статусу
    if (status) {
      where.cardStatus = status;
    }

    // Фильтр по цене (теперь это обычное поле)
    if (minPrice !== undefined) {
      where.price = { ...where.price, gte: minPrice };
    }
    if (maxPrice !== undefined) {
      where.price = { ...where.price, lte: maxPrice };
    }

    // Получаем товары
    const products = await this.prisma.product.findMany({
      where,
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      take: limit,
      skip: offset,
    });

    // Фильтрация по наличию (после запроса, т.к. stock это JSON)
    let filteredProducts = products;

    if (inStock) {
      filteredProducts = products.filter((product) => {
        const stock = product.stock as any;
        const hasStock = Object.values(stock || {}).some((qty: any) => qty > 0);
        return hasStock;
      });
    }

    // Получаем общее количество
    const total = await this.prisma.product.count({ where });

    return {
      products: filteredProducts,
      total,
      limit,
      offset,
    };
  }

  /**
   * Поиск товаров
   */
  async searchProducts(query: string) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Запрос должен содержать минимум 2 символа');
    }

    return this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      take: 20,
    });
  }

  /**
   * Популярные товары (топ продаж)
   */
  async getPopularProducts(limit: number = 10) {
    return this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { salesCount: 'desc' },
      take: limit,
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  /**
   * Товары в распродаже
   */
  async getSaleProducts(limit: number = 20) {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        cardStatus: 'SALE',
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Новинки
   */
  async getNewProducts(limit: number = 20) {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        cardStatus: 'NEW',
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ==================== РАБОТА С ОСТАТКАМИ ====================

  /**
   * Проверить наличие товара
   */
  async isInStock(
    productId: number,
    size: string,
  ): Promise<boolean> {
    const quantity = await this.getStockQuantity(productId, size);
    return quantity > 0;
  }

  /**
   * Получить количество на складе
   */
  async getStockQuantity(
    productId: number,
    size: string,
  ): Promise<number> {
    const product = await this.getProductById(productId);
    const stock = product.stock as any;

    return stock?.[size] || 0;
  }

  /**
   * Уменьшить остатки после продажи
   */
  async decreaseStock(
    productId: number,
    size: string,
    quantity: number,
  ) {
    const product = await this.getProductById(productId);
    const stock = product.stock as any;

    const currentStock = stock?.[size] || 0;

    if (currentStock < quantity) {
      throw new BadRequestException(
        `Недостаточно товара на складе. Доступно: ${currentStock}, запрошено: ${quantity}`,
      );
    }

    // Обновляем остатки
    const newStock = { ...stock };
    newStock[size] = currentStock - quantity;

    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    this.logger.log(
      `Остатки обновлены: товар ${productId}, размер ${size}: ${currentStock} -> ${newStock[size]}`,
    );

    return newStock;
  }

  /**
   * Увеличить остатки (возврат товара)
   */
  async increaseStock(
    productId: number,
    size: string,
    quantity: number,
  ) {
    const product = await this.getProductById(productId);
    const stock = product.stock as any;

    const currentStock = stock?.[size] || 0;

    // Обновляем остатки
    const newStock = { ...stock };
    newStock[size] = currentStock + quantity;

    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    this.logger.log(
      `Остатки увеличены: товар ${productId}, размер ${size}: ${currentStock} -> ${newStock[size]}`,
    );

    return newStock;
  }

  // ==================== РАБОТА С ЦЕНАМИ ====================

  /**
   * Получить итоговую цену товара со скидкой
   */
  async getFinalPrice(productId: number): Promise<number> {
    const product = await this.getProductById(productId);
    const finalPrice = Math.floor(product.price - (product.price * product.discount) / 100);
    return finalPrice;
  }

  // ==================== СЧЁТЧИКИ ====================

  /**
   * Увеличить счётчик просмотров
   */
  async incrementViewCount(productId: number) {
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        viewCount: { increment: 1 },
      },
    });
  }

  /**
   * Увеличить счётчик продаж
   */
  async incrementSalesCount(productId: number, quantity: number = 1) {
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        salesCount: { increment: quantity },
      },
    });

    this.logger.log(`Продажи обновлены: товар ${productId}, +${quantity}`);
  }

  // ==================== КАТЕГОРИИ ====================

  /**
   * Получить все активные категории
   */
  async getCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Получить категорию по slug
   */
  async getCategoryBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
    });
  }

  /**
   * Обновить баннеры категории
   */
  async updateCategoryBanners(
    categoryId: number,
    desktopBanner?: Express.Multer.File,
    mobileBanner?: Express.Multer.File,
  ) {
    // Проверяем что категория существует
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    const updateData: any = {};
    const uploadsDir = path.join(process.cwd(), 'uploads', 'categories');

    // Создаем директорию если её нет
    await fs.mkdir(uploadsDir, { recursive: true });

    // Обновляем десктопный баннер
    if (desktopBanner) {
      // Удаляем старый файл если есть
      if (category.desktopBannerUrl) {
        try {
          const oldFile = path.join(process.cwd(), category.desktopBannerUrl.replace(/^\//, ''));
          await fs.unlink(oldFile);
        } catch (error) {
          this.logger.warn(`Failed to delete old desktop banner: ${error.message}`);
        }
      }

      // Сохраняем новый файл
      const timestamp = Date.now();
      const ext = path.extname(desktopBanner.originalname);
      const filename = `desktop-cat${categoryId}-${timestamp}${ext}`;
      const filepath = path.join(uploadsDir, filename);
      await fs.writeFile(filepath, desktopBanner.buffer);
      updateData.desktopBannerUrl = `/uploads/categories/${filename}`;
    }

    // Обновляем мобильный баннер
    if (mobileBanner) {
      // Удаляем старый файл если есть
      if (category.mobileBannerUrl) {
        try {
          const oldFile = path.join(process.cwd(), category.mobileBannerUrl.replace(/^\//, ''));
          await fs.unlink(oldFile);
        } catch (error) {
          this.logger.warn(`Failed to delete old mobile banner: ${error.message}`);
        }
      }

      // Сохраняем новый файл
      const timestamp = Date.now();
      const ext = path.extname(mobileBanner.originalname);
      const filename = `mobile-cat${categoryId}-${timestamp}${ext}`;
      const filepath = path.join(uploadsDir, filename);
      await fs.writeFile(filepath, mobileBanner.buffer);
      updateData.mobileBannerUrl = `/uploads/categories/${filename}`;
    }

    // Обновляем категорию в БД
    return this.prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    });
  }
}
