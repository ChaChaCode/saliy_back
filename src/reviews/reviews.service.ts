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
   * Админ: список всех отзывов с фильтром + информация об авторе
   */
  async findAllAdmin(params: {
    status?: ReviewStatus;
    productId?: number;
    userId?: string;
    search?: string; // поиск по authorName / text
    page?: number;
    limit?: number;
  }) {
    const { status, productId, userId, search, page = 1, limit = 20 } = params;

    const where: Prisma.ReviewWhereInput = {};
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { authorName: { contains: search, mode: 'insensitive' } },
        { text: { contains: search, mode: 'insensitive' } },
      ];
    }

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

    const products = await this.fetchProductsForReviews(reviews);
    const users = await this.fetchUsersForReviews(reviews);

    return {
      reviews: reviews.map((r) => this.enrichAdminReview(r, products, users)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Админ: получить отзыв по id с полной инфой (автор + товар)
   */
  async findAdminById(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Отзыв ${id} не найден`);

    const products = await this.fetchProductsForReviews([review]);
    const users = await this.fetchUsersForReviews([review]);
    return this.enrichAdminReview(review, products, users);
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

  // ================= ADMIN CRUD =================

  /**
   * Админ: создать отзыв. Обходит проверку DELIVERED-заказа.
   * Может задать userId явно (если нужно привязать к существующему юзеру) или оставить пустым.
   */
  async createAsAdmin(
    dto: {
      productId: number;
      authorName: string;
      rating: number;
      text?: string;
      status?: ReviewStatus;
      userId?: string;
    },
    images: Express.Multer.File[] = [],
    adminId?: string,
  ) {
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

    if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException(`Пользователь ${dto.userId} не найден`);
      }
    }

    const uploadedKeys: string[] = [];
    try {
      for (const file of images) {
        const key = await this.uploadImage(file, dto.productId, dto.userId);
        uploadedKeys.push(key);
      }
    } catch (error: any) {
      for (const key of uploadedKeys) await this.s3.delete(key);
      throw new BadRequestException('Не удалось загрузить фото отзыва');
    }

    const isImmediatelyApproved = dto.status === 'APPROVED';
    const review = await this.prisma.review.create({
      data: {
        productId: dto.productId,
        userId: dto.userId ?? null,
        authorName: dto.authorName,
        rating: dto.rating,
        text: dto.text,
        images: uploadedKeys as Prisma.InputJsonValue,
        status: dto.status ?? 'PENDING',
        moderatedAt: isImmediatelyApproved ? new Date() : null,
        moderatedBy: isImmediatelyApproved ? adminId : null,
      },
    });

    this.logger.log(
      `Админ создал отзыв ${review.id} на товар ${dto.productId} (status=${review.status})`,
    );
    return this.findAdminById(review.id);
  }

  /**
   * Админ: обновить отзыв. Можно менять text, rating, authorName, status.
   * Изображения — отдельными методами addImagesAdmin / removeImageAdmin.
   */
  async updateAsAdmin(
    id: string,
    dto: {
      authorName?: string;
      rating?: number;
      text?: string | null;
      status?: ReviewStatus;
    },
    adminId?: string,
  ) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Отзыв ${id} не найден`);

    if (dto.rating !== undefined && (dto.rating < 1 || dto.rating > 5)) {
      throw new BadRequestException('Рейтинг должен быть от 1 до 5');
    }
    if (dto.text !== undefined && dto.text !== null && dto.text.length > REVIEW_MAX_TEXT) {
      throw new BadRequestException(
        `Текст отзыва не может превышать ${REVIEW_MAX_TEXT} символов`,
      );
    }

    const data: Prisma.ReviewUpdateInput = {};
    if (dto.authorName !== undefined) data.authorName = dto.authorName;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.text !== undefined) data.text = dto.text;
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.moderatedAt = new Date();
      data.moderatedBy = adminId ?? null;
    }

    await this.prisma.review.update({ where: { id }, data });
    return this.findAdminById(id);
  }

  /**
   * Админ: добавить фото к существующему отзыву.
   */
  async addImagesAdmin(id: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Нужно прикрепить хотя бы одно фото');
    }

    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Отзыв ${id} не найден`);

    const existing = Array.isArray(review.images) ? (review.images as string[]) : [];
    if (existing.length + files.length > REVIEW_MAX_IMAGES) {
      throw new BadRequestException(
        `У отзыва уже ${existing.length} фото, максимум ${REVIEW_MAX_IMAGES}`,
      );
    }

    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const key = await this.uploadImage(file, review.productId, review.userId ?? undefined);
        uploaded.push(key);
      }
    } catch {
      for (const key of uploaded) await this.s3.delete(key);
      throw new BadRequestException('Не удалось загрузить фото');
    }

    await this.prisma.review.update({
      where: { id },
      data: { images: [...existing, ...uploaded] as Prisma.InputJsonValue },
    });

    return this.findAdminById(id);
  }

  /**
   * Админ: удалить одну фотку из отзыва (по URL или S3-ключу).
   */
  async removeImageAdmin(id: string, imageUrl: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Отзыв ${id} не найден`);

    const target = this.s3.extractKey(imageUrl);
    if (!target) {
      throw new BadRequestException('imageUrl is empty after normalization');
    }

    const existing = Array.isArray(review.images) ? (review.images as string[]) : [];
    const index = existing.findIndex((k) => this.s3.extractKey(k) === target);
    if (index === -1) {
      throw new BadRequestException('Image not found in review');
    }

    const [removed] = existing.splice(index, 1);
    await this.s3.delete(removed);

    await this.prisma.review.update({
      where: { id },
      data: { images: existing as Prisma.InputJsonValue },
    });

    return this.findAdminById(id);
  }

  // ================= HELPERS =================

  private async uploadImage(
    file: Express.Multer.File,
    productId: number,
    userId?: string,
  ): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const author = userId || 'admin';
    const key = `reviews/${productId}/${author}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
    try {
      return await this.s3.upload(key, file.buffer, file.mimetype);
    } catch (error: any) {
      this.logger.error(`Не удалось загрузить фото отзыва: ${error.message}`);
      throw error;
    }
  }

  private async fetchProductsForReviews(
    reviews: Array<{ productId: number }>,
  ) {
    const ids = Array.from(new Set(reviews.map((r) => r.productId)));
    if (ids.length === 0) return new Map<number, { id: number; name: string; slug: string }>();
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true },
    });
    return new Map(products.map((p) => [p.id, p]));
  }

  private async fetchUsersForReviews(reviews: Array<{ userId: string | null }>) {
    const ids = Array.from(
      new Set(reviews.map((r) => r.userId).filter((v): v is string => !!v)),
    );
    if (ids.length === 0) return new Map<string, { id: string; email: string; name: string | null; firstName: string | null; lastName: string | null }>();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });
    return new Map(users.map((u) => [u.id, u]));
  }

  private enrichAdminReview(
    review: any,
    productMap: Map<number, { id: number; name: string; slug: string }>,
    userMap: Map<
      string,
      { id: string; email: string; name: string | null; firstName: string | null; lastName: string | null }
    >,
  ) {
    return {
      ...this.withImageUrls(review),
      product: productMap.get(review.productId) ?? null,
      user: review.userId ? userMap.get(review.userId) ?? null : null,
    };
  }
}
