import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from '../common/storage/s3-storage.service';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateReviewInput {
  productId: number;
  authorName: string;
  rating: number;
  text?: string;
}

export const REVIEW_MAX_TEXT = 1000;
export const REVIEW_MAX_IMAGES = 5;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private readonly s3Prefix = 'reviews';

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
  ) {}

  /**
   * Создать отзыв. Только для авторизованных пользователей,
   * у которых есть DELIVERED-заказ с этим товаром.
   */
  async create(
    dto: CreateReviewInput,
    userId: string,
    images: Express.Multer.File[] = [],
  ) {
    if (!userId) {
      throw new ForbiddenException('Только авторизованные могут оставлять отзывы');
    }
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Рейтинг должен быть от 1 до 5');
    }
    if (dto.text && dto.text.length > REVIEW_MAX_TEXT) {
      throw new BadRequestException(
        `Текст отзыва не может превышать ${REVIEW_MAX_TEXT} символов`,
      );
    }
    if (images.length > REVIEW_MAX_IMAGES) {
      throw new BadRequestException(
        `Можно прикрепить не более ${REVIEW_MAX_IMAGES} фото`,
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар ${dto.productId} не найден`);
    }

    // Проверяем, что у пользователя был полученный заказ с этим товаром
    const delivered = await this.prisma.orderItem.findFirst({
      where: {
        productId: dto.productId,
        order: {
          userId,
          status: 'DELIVERED',
        },
      },
      select: { id: true },
    });
    if (!delivered) {
      throw new ForbiddenException(
        'Оставить отзыв можно только на товар из полученного заказа',
      );
    }

    // Один отзыв на товар от одного пользователя
    const existing = await this.prisma.review.findFirst({
      where: { productId: dto.productId, userId },
    });
    if (existing) {
      throw new BadRequestException('Вы уже оставили отзыв на этот товар');
    }

    // Загружаем изображения в S3
    const uploadedKeys: string[] = [];
    try {
      for (const file of images) {
        const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
        const key = `${this.s3Prefix}/${dto.productId}/${userId}-${Date.now()}-${uploadedKeys.length}.${ext}`;
        await this.s3.upload(key, file.buffer, file.mimetype);
        uploadedKeys.push(key);
      }
    } catch (error: any) {
      // Откатываем уже залитые картинки, если упали посреди
      for (const key of uploadedKeys) {
        await this.s3.delete(key);
      }
      this.logger.error(`Не удалось загрузить фото отзыва: ${error.message}`);
      throw new BadRequestException('Не удалось загрузить фото отзыва');
    }

    const review = await this.prisma.review.create({
      data: {
        productId: dto.productId,
        userId,
        authorName: dto.authorName,
        rating: dto.rating,
        text: dto.text,
        images: uploadedKeys as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Отзыв создан: ${review.id} для товара ${dto.productId} (фото: ${uploadedKeys.length})`,
    );
    return this.withImageUrls(review);
  }

  private withImageUrls<T extends { images: unknown }>(review: T): T {
    const keys = Array.isArray(review.images) ? (review.images as string[]) : [];
    return { ...review, images: keys.map((k) => this.s3.keyToUrl(k)) as any };
  }

  /**
   * Может ли пользователь оставить отзыв на товар?
   * Пригодится фронту для показа/скрытия формы отзыва.
   */
  async canReview(productId: number, userId: string) {
    if (!userId) {
      return { canReview: false, reason: 'NOT_AUTHENTICATED' as const };
    }

    const [alreadyReviewed, delivered] = await Promise.all([
      this.prisma.review.findFirst({
        where: { productId, userId },
        select: { id: true },
      }),
      this.prisma.orderItem.findFirst({
        where: {
          productId,
          order: { userId, status: 'DELIVERED' },
        },
        select: { id: true },
      }),
    ]);

    if (alreadyReviewed) {
      return { canReview: false, reason: 'ALREADY_REVIEWED' as const };
    }
    if (!delivered) {
      return { canReview: false, reason: 'NO_DELIVERED_ORDER' as const };
    }
    return { canReview: true };
  }

  /**
   * Получить одобренные отзывы товара (публично)
   */
  async findByProduct(productId: number) {
    const reviews = await this.prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        authorName: true,
        rating: true,
        text: true,
        images: true,
        createdAt: true,
      },
    });

    const aggregate = await this.prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });

    return {
      reviews: reviews.map((r) => this.withImageUrls(r)),
      averageRating: aggregate._avg.rating
        ? Math.round(aggregate._avg.rating * 10) / 10
        : 0,
      totalReviews: aggregate._count,
    };
  }

  /**
   * Админ: список всех отзывов с фильтром
   */
  async findAllAdmin(params: {
    status?: ReviewStatus;
    productId?: number;
    page?: number;
    limit?: number;
  }) {
    const { status, productId, page = 1, limit = 20 } = params;

    const where: Prisma.ReviewWhereInput = {};
    if (status) where.status = status;
    if (productId) where.productId = productId;

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    const productIds: number[] = Array.from(
      new Set(reviews.map((r) => r.productId)),
    );
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      reviews: reviews.map((r) => ({
        ...this.withImageUrls(r),
        product: productMap.get(r.productId) || null,
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
   * Админ: одобрить
   */
  async approve(id: string, adminId?: string) {
    return this.moderate(id, 'APPROVED', adminId);
  }

  /**
   * Админ: отклонить
   */
  async reject(id: string, adminId?: string) {
    return this.moderate(id, 'REJECTED', adminId);
  }

  private async moderate(
    id: string,
    status: ReviewStatus,
    adminId?: string,
  ) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Отзыв ${id} не найден`);

    return this.prisma.review.update({
      where: { id },
      data: {
        status,
        moderatedAt: new Date(),
        moderatedBy: adminId,
      },
    });
  }

  /**
   * Админ: удалить. Картинки из S3 тоже убираем.
   */
  async remove(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Отзыв ${id} не найден`);

    const keys = Array.isArray(review.images) ? (review.images as string[]) : [];
    for (const key of keys) {
      await this.s3.delete(key);
    }

    await this.prisma.review.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Статистика отзывов (для дашборда)
   */
  async getStats() {
    const [pending, approved, rejected] = await Promise.all([
      this.prisma.review.count({ where: { status: 'PENDING' } }),
      this.prisma.review.count({ where: { status: 'APPROVED' } }),
      this.prisma.review.count({ where: { status: 'REJECTED' } }),
    ]);
    return { pending, approved, rejected, total: pending + approved + rejected };
  }
}
