import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProductDto } from './dto/admin-product.dto';
import { card_status, gender_type, category_type } from '@prisma/client';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'products');

  constructor(private prisma: PrismaService) {
    // Создаём директорию для загрузок, если её нет
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create uploads directory', error);
    }
  }

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

    // Обработка загруженных изображений
    const newImages: any[] = [];
    if (imageFiles && imageFiles.length > 0) {
      for (const file of imageFiles) {
        const filename = `product-${id}-${Date.now()}-${file.originalname}`;
        const filepath = join(this.uploadsDir, filename);

        try {
          await fs.writeFile(filepath, file.buffer);
          newImages.push({
            url: `/uploads/products/${filename}`,
            isPreview: false,
            previewOrder: 999,
          });
        } catch (error) {
          this.logger.error(`Failed to save image: ${filename}`, error);
        }
      }
    }

    // Объединяем существующие и новые изображения
    let images = existingProduct.images as any[];
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
   * Удалить конкретное изображение товара
   */
  async deleteProductImage(id: number, imageUrl: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    let images = product.images as any[];

    // Находим изображение
    const imageIndex = images.findIndex((img) => img.url === imageUrl);
    if (imageIndex === -1) {
      throw new BadRequestException('Image not found in product');
    }

    // Удаляем файл с диска
    const filename = imageUrl.split('/').pop();
    if (filename) {
      const filepath = join(this.uploadsDir, filename);
      try {
        await fs.unlink(filepath);
      } catch (error) {
        this.logger.warn(`Failed to delete image file: ${filename}`, error);
      }
    }

    // Удаляем из массива
    images.splice(imageIndex, 1);

    // Обновляем товар
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: { images },
    });

    return {
      message: 'Image deleted successfully',
      product: updatedProduct,
    };
  }
}
