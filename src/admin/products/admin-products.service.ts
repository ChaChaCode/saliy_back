import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/admin-product.dto';
import { card_status, gender_type, category_type } from '@prisma/client';
import { S3StorageService } from '../../common/storage/s3-storage.service';

interface ProductImage {
  url: string;           // S3-ключ (products/...jpg)
  isPreview: boolean;    // true, если previewOrder ∈ {1,2}
  previewOrder: number;  // 1 — primary, 2 — hover, 999 — не превью
}

const NON_PREVIEW_ORDER = 999;

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);
  private readonly s3Prefix = 'products';

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
  ) {}

  /**
   * Получить все товары с фильтрацией и пагинацией
   */
  async getAllProducts(filters: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    gender?: string;
    cardStatus?: string;
    isActive?: boolean;
  }) {
    const { page, limit, search, category, gender, cardStatus, isActive } =
      filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender) {
      where.gender = gender;
    }

    if (cardStatus) {
      where.cardStatus = cardStatus;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (category) {
      where.categories = {
        some: {
          category: {
            slug: category,
          },
        },
      };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: products.map((p) => ({
        ...p,
        categories: p.categories.map((pc) => pc.category),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    return {
      ...product,
      categories: product.categories.map((pc) => pc.category),
    };
  }

  /**
   * Товары с низким остатком на складе
   */
  async getLowStockProducts(threshold = 5) {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        stock: true,
        images: true,
        price: true,
        discount: true,
      },
    });

    const lowStockProducts = products
      .map((p) => {
        const stock = (p.stock as Record<string, number>) || {};
        const lowSizes = Object.entries(stock)
          .filter(([, qty]) => qty <= threshold)
          .map(([size, qty]) => ({ size, quantity: qty }));

        if (lowSizes.length === 0) return null;

        const images = (p.images as any[]) || [];
        const imageUrl =
          Array.isArray(images) && images.length > 0 ? images[0] : null;

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          discount: p.discount,
          imageUrl,
          lowSizes,
          totalStock: Object.values(stock).reduce(
            (sum: number, q: any) => sum + (q || 0),
            0,
          ),
        };
      })
      .filter((p) => p !== null);

    return {
      threshold,
      count: lowStockProducts.length,
      products: lowStockProducts,
    };
  }

  /**
   * Получить enums для товаров
   */
  async getEnums() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      genders: Object.values(gender_type),
      cardStatuses: Object.values(card_status),
      categoryTypes: Object.values(category_type),
      categories,
    };
  }

  /**
   * Создать товар
   */
  async createProduct(
    dto: CreateProductDto,
    imageFiles?: Express.Multer.File[],
  ) {
    // Проверяем уникальность slug
    const existing = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException(`Slug "${dto.slug}" уже используется`);
    }

    // Загружаем фото в S3. Первая — primary (previewOrder=1), вторая — hover (2), остальные — не превью.
    const images: ProductImage[] = [];
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const key = await this.uploadImage(imageFiles[i], i);
        const order = i === 0 ? 1 : i === 1 ? 2 : NON_PREVIEW_ORDER;
        images.push({
          url: key,
          isPreview: order <= 2,
          previewOrder: order,
        });
      }
    }

    const { categoryIds, ...productData } = dto;

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        images: images as any,
        stock: dto.stock || {},
        ...(categoryIds && categoryIds.length > 0
          ? {
              categories: {
                create: categoryIds.map((categoryId) => ({ categoryId })),
              },
            }
          : {}),
      },
      include: {
        categories: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, type: true },
            },
          },
        },
      },
    });

    this.logger.log(`Создан товар: ${product.id} - ${product.name}`);

    return {
      ...product,
      categories: product.categories.map((pc) => pc.category),
    };
  }

  /**
   * Удалить товар
   */
  async deleteProduct(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        orderItems: { select: { id: true } },
        cartItems: { select: { id: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Если есть заказы — деактивируем вместо удаления
    if (product.orderItems.length > 0) {
      const updated = await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.warn(
        `Товар ${id} деактивирован (есть заказы: ${product.orderItems.length})`,
      );

      return {
        success: true,
        deleted: false,
        message: `Товар деактивирован, так как есть связанные заказы (${product.orderItems.length})`,
        product: updated,
      };
    }

    // Нет заказов — можно удалить физически
    const images = (product.images as unknown as ProductImage[]) || [];
    for (const img of images) {
      await this.s3.delete(img.url);
    }
    // Cascade удалит: productCategories, cartItems
    await this.prisma.product.delete({ where: { id } });

    this.logger.warn(`Товар удалён: ${id} - ${product.name}`);

    return {
      success: true,
      deleted: true,
      message: 'Товар удалён',
    };
  }

  /**
   * Обновить товар
   */
  async updateProduct(
    id: number,
    updateProductDto: UpdateProductDto,
    imageFiles?: Express.Multer.File[],
  ) {
    // Проверяем существование товара
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Обработка новых загруженных изображений — пишем в S3, добавляем без превью
    const newImages: ProductImage[] = [];
    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const key = await this.uploadImage(imageFiles[i], i, id);
        newImages.push({
          url: key,
          isPreview: false,
          previewOrder: NON_PREVIEW_ORDER,
        });
      }
    }

    // Объединяем существующие и новые изображения
    let images = existingProduct.images as unknown as ProductImage[];
    if (newImages.length > 0) {
      images = [...images, ...newImages];
    }

    // Подготовка данных для обновления
    const updateData: any = {
      ...updateProductDto,
      images,
    };

    // Обновление категорий (если переданы)
    if (updateProductDto.categoryIds !== undefined) {
      // Удаляем старые связи
      await this.prisma.productCategory.deleteMany({
        where: { productId: id },
      });

      // Создаём новые связи
      if (updateProductDto.categoryIds.length > 0) {
        await this.prisma.productCategory.createMany({
          data: updateProductDto.categoryIds.map((categoryId) => ({
            productId: id,
            categoryId,
          })),
        });
      }

      delete updateData.categoryIds;
    }

    // Обновляем товар
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
      },
    });

    return {
      ...updatedProduct,
      categories: updatedProduct.categories.map((pc) => pc.category),
    };
  }

  /**
   * Удалить конкретное изображение товара.
   * Принимает полный URL или голый S3-ключ — нормализуем перед сравнением.
   */
  async deleteProductImage(id: number, imageUrl: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const targetKey = this.s3.extractKey(imageUrl);
    if (!targetKey) {
      throw new BadRequestException('imageUrl is empty after normalization');
    }

    const images = (product.images as unknown as ProductImage[]) || [];
    const index = images.findIndex(
      (img) => this.s3.extractKey(img.url) === targetKey,
    );
    if (index === -1) {
      throw new BadRequestException('Image not found in product');
    }

    const [removed] = images.splice(index, 1);
    await this.s3.delete(removed.url);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: { images: images as any },
    });

    return {
      message: 'Image deleted successfully',
      product: updatedProduct,
    };
  }

  /**
   * Добавить новые фотографии к товару (без замены существующих).
   * Новые фото добавляются как НЕ превью.
   */
  async addProductImages(id: number, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Нужно прикрепить хотя бы одно фото');
    }

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const existing = (product.images as unknown as ProductImage[]) || [];
    const added: ProductImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const key = await this.uploadImage(files[i], existing.length + i, id);
      added.push({
        url: key,
        isPreview: false,
        previewOrder: NON_PREVIEW_ORDER,
      });
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { images: [...existing, ...added] as any },
    });

    return {
      message: `Добавлено ${added.length} фото`,
      product: updated,
    };
  }

  /**
   * Установить превью-фото: до 2 штук.
   *   primary — основное (previewOrder=1), обязательное.
   *   hover   — показывается при наведении (previewOrder=2), опциональное.
   * Остальные фото получают previewOrder = 999 и isPreview=false.
   * Параметры принимают как полный URL, так и голый S3-ключ.
   */
  async setProductPreviews(
    id: number,
    params: { primary: string; hover?: string | null },
  ) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const primaryKey = this.s3.extractKey(params.primary);
    const hoverKey = params.hover ? this.s3.extractKey(params.hover) : null;

    if (!primaryKey) {
      throw new BadRequestException('primary изображение обязательно');
    }
    if (hoverKey && hoverKey === primaryKey) {
      throw new BadRequestException(
        'primary и hover не могут быть одним и тем же изображением',
      );
    }

    const images = (product.images as unknown as ProductImage[]) || [];
    const keys = images.map((i) => this.s3.extractKey(i.url));

    if (!keys.includes(primaryKey)) {
      throw new BadRequestException('primary изображение не найдено у товара');
    }
    if (hoverKey && !keys.includes(hoverKey)) {
      throw new BadRequestException('hover изображение не найдено у товара');
    }

    const updatedImages = images.map<ProductImage>((img) => {
      const key = this.s3.extractKey(img.url);
      if (key === primaryKey) {
        return { ...img, isPreview: true, previewOrder: 1 };
      }
      if (hoverKey && key === hoverKey) {
        return { ...img, isPreview: true, previewOrder: 2 };
      }
      return { ...img, isPreview: false, previewOrder: NON_PREVIEW_ORDER };
    });

    const updated = await this.prisma.product.update({
      where: { id },
      data: { images: updatedImages as any },
    });

    return {
      message: 'Превью обновлены',
      product: updated,
    };
  }

  /**
   * Загрузить файл в S3 по ключу `products/{productId?}/{timestamp}-{i}.ext`.
   */
  private async uploadImage(
    file: Express.Multer.File,
    index: number,
    productId?: number,
  ): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const dir = productId ? `${this.s3Prefix}/${productId}` : this.s3Prefix;
    const key = `${dir}/${Date.now()}-${index}.${ext}`;
    try {
      return await this.s3.upload(key, file.buffer, file.mimetype);
    } catch (error: any) {
      this.logger.error(`Failed to upload product image to S3: ${key}`, error);
      throw new BadRequestException('Не удалось загрузить изображение');
    }
  }
}
