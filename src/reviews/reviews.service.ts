import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface CreateReviewDto {
  productId: number;
  authorName: string;
  rating: number;
  text?: string;
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Создать отзыв (публично, требуется авторизация для userId)
   */
  async create(dto: CreateReviewDto, userId?: string) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Рейтинг должен быть от 1 до 5');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Товар ${dto.productId} не найден`);
    }

    // Один пользователь — один отзыв на товар
    if (userId) {
      const existing = await this.prisma.review.findFirst({
        where: { productId: dto.productId, userId },
      });
      if (existing) {
        throw new BadRequestException('Вы уже оставили отзыв на этот товар');
      }
    }

    const review = await this.prisma.review.create({
      data: {
        productId: dto.productId,
        userId,
        authorName: dto.authorName,
        rating: dto.rating,
        text: dto.text,
        status: 'PENDING',
      },
    });

    this.logger.log(`Отзыв создан: ${review.id} для товара ${dto.productId}`);
    return review;
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
        createdAt: true,
      },
    });

    const aggregate = await this.prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });

    return {
      reviews,
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

    // Подтягиваем имена товаров отдельно (нет relation в prisma)
    const productIds = [...new Set(reviews.map((r) => r.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      reviews: reviews.map((r) => ({
        ...r,
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
   * Админ: удалить
   */
  async remove(id: string) {
    try {
      await this.prisma.review.delete({ where: { id } });
      return { success: true };
    } catch {
      throw new NotFoundException(`Отзыв ${id} не найден`);
    }
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
