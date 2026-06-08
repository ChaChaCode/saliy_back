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
  order: number;         // позиция в галерее (0,1,2...) — независимый порядок
  isPreview: boolean;    // true, если previewOrder ∈ {1,2}
  previewOrder: number;  // 1 — primary, 2 — hover, 999 — не превью
}

const NON_PREVIEW_ORDER = 999;
const MAX_PREVIEW = 2;

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
        const previewOrder = i === 0 ? 1 : i === 1 ? 2 : NON_PREVIEW_ORDER;
        images.push({
          url: key,
          order: i, // позиция в галерее по индексу загрузки
          isPreview: previewOrder <= MAX_PREVIEW,
          previewOrder,
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

    // Объединяем существующие и новые изображения
    let images = (existingProduct.images as unknown as ProductImage[]) || [];

    // Обработка новых загруженных изображений — пишем в S3, добавляем без превью
    if (imageFiles && imageFiles.length > 0) {
      let nextOrder = this.maxOrder(images) + 1;
      const newImages: ProductImage[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const key = await this.uploadImage(imageFiles[i], i, id);
        newImages.push({
          url: key,
          order: nextOrder++,
          isPreview: false,
          previewOrder: NON_PREVIEW_ORDER,
        });
      }
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

    // Пересчитываем order оставшихся (0,1,2...) по текущему порядку, чтобы не было дыр
    const reordered = images.map<ProductImage>((img, idx) => ({
      ...img,
      order: idx,
    }));

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: { images: reordered as any },
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
    let nextOrder = this.maxOrder(existing) + 1;
    const added: ProductImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const key = await this.uploadImage(files[i], existing.length + i, id);
      added.push({
        url: key,
        order: nextOrder++,
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
   * Обновить весь массив изображений товара за один запрос:
   * порядок галереи (order), флаги превью (isPreview) и previewOrder.
   *
   * Валидация:
   *   - не больше 2 фото с isPreview=true;
   *   - у превью-фото previewOrder ∈ {1,2} и они уникальны;
   *   - все переданные url должны существовать в текущем товаре (нельзя подсунуть левые).
   * Нормализация:
   *   - order переставляется 0..n по порядку переданного массива;
   *   - не-превью → isPreview=false, previewOrder=999.
   * Параметры url принимают как полный URL, так и голый S3-ключ.
   */
  async updateProductImages(id: number, images: ProductImage[]) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (!Array.isArray(images) || images.length === 0) {
      throw new BadRequestException('images не может быть пустым');
    }

    const current = (product.images as unknown as ProductImage[]) || [];
    const currentKeys = new Set(
      current.map((img) => this.s3.extractKey(img.url)),
    );

    // Проверяем, что все url существуют в товаре и нет дублей
    const seenKeys = new Set<string>();
    for (const img of images) {
      const key = this.s3.extractKey(img.url);
      if (!key) {
        throw new BadRequestException('Пустой url в одном из изображений');
      }
      if (!currentKeys.has(key)) {
        throw new BadRequestException(
          `Изображение не найдено у товара: ${img.url}`,
        );
      }
      if (seenKeys.has(key)) {
        throw new BadRequestException(`Дубликат изображения: ${img.url}`);
      }
      seenKeys.add(key);
    }

    // Превью: не больше MAX_PREVIEW, previewOrder уникальны и ∈ {1,2}
    const previews = images.filter((img) => img.isPreview === true);
    if (previews.length > MAX_PREVIEW) {
      throw new BadRequestException(
        `Можно выбрать не более ${MAX_PREVIEW} превью-фото`,
      );
    }
    const previewOrders = new Set<number>();
    for (const img of previews) {
      const po = Number(img.previewOrder);
      if (po !== 1 && po !== 2) {
        throw new BadRequestException(
          'previewOrder у превью должен быть 1 (primary) или 2 (hover)',
        );
      }
      if (previewOrders.has(po)) {
        throw new BadRequestException(
          `previewOrder ${po} указан более одного раза`,
        );
      }
      previewOrders.add(po);
    }

    // Нормализуем: order 0..n по порядку массива; ключи сохраняем как в БД
    const keyToCurrentUrl = new Map(
      current.map((img) => [this.s3.extractKey(img.url), img.url]),
    );
    const normalized = images.map<ProductImage>((img, idx) => {
      const key = this.s3.extractKey(img.url);
      const url = keyToCurrentUrl.get(key) ?? img.url;
      if (img.isPreview === true) {
        return { url, order: idx, isPreview: true, previewOrder: Number(img.previewOrder) };
      }
      return { url, order: idx, isPreview: false, previewOrder: NON_PREVIEW_ORDER };
    });

    const updated = await this.prisma.product.update({
      where: { id },
      data: { images: normalized as any },
    });

    return {
      message: 'Изображения обновлены',
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

    const updatedImages = images.map<ProductImage>((img, idx) => {
      // Проставляем order, если у старых записей его нет
      const order = typeof img.order === 'number' ? img.order : idx;
      const key = this.s3.extractKey(img.url);
      if (key === primaryKey) {
        return { ...img, order, isPreview: true, previewOrder: 1 };
      }
      if (hoverKey && key === hoverKey) {
        return { ...img, order, isPreview: true, previewOrder: 2 };
      }
      return { ...img, order, isPreview: false, previewOrder: NON_PREVIEW_ORDER };
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
   * Максимальный order среди фото (старые записи без order считаем -1,
   * чтобы новые получили 0,1,2...). Если массив пуст — вернёт -1.
   */
  private maxOrder(images: ProductImage[]): number {
    return images.reduce(
      (max, img) =>
        typeof img.order === 'number' && img.order > max ? img.order : max,
      -1,
    );
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
