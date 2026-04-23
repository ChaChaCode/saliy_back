import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type SortBy = 'createdAt' | 'ordersCount' | 'totalSpent' | 'lastOrderAt';

interface FindAllParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  hasOrders?: boolean;
  sortBy?: SortBy;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список пользователей с фильтрами, агрегатами (ordersCount/totalSpent/lastOrderAt)
   * и сортировкой по любому из этих полей.
   */
  async findAll(params: FindAllParams) {
    const {
      search,
      dateFrom,
      dateTo,
      hasOrders,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = params;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (hasOrders !== undefined) {
      where.orders = hasOrders ? { some: {} } : { none: {} };
    }

    const skip = (page - 1) * limit;

    // sortBy=createdAt — простая сортировка на уровне БД.
    // Для агрегатов (ordersCount / totalSpent / lastOrderAt) БД нативно не умеет,
    // поэтому сначала достаём пользователей по фильтру, потом докидываем агрегаты и сортируем в памяти.
    // Пагинацию в этом режиме тоже применяем после сортировки.

    if (sortBy === 'createdAt') {
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          orderBy: { createdAt: sortOrder },
          skip,
          take: limit,
          ...this.listSelect,
        }),
        this.prisma.user.count({ where }),
      ]);

      const aggregates = await this.fetchAggregatesForUsers(users.map((u) => u.id));

      return {
        users: users.map((u) => this.toListItem(u, aggregates)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // ---- сортировка по агрегатам: выбираем ВСЁ по фильтру (без пагинации на БД), потом сортируем и режем в памяти ----
    const [allUsers, total] = await Promise.all([
      this.prisma.user.findMany({ where, ...this.listSelect }),
      this.prisma.user.count({ where }),
    ]);
    const aggregates = await this.fetchAggregatesForUsers(allUsers.map((u) => u.id));

    const enriched = allUsers.map((u) => this.toListItem(u, aggregates));

    enriched.sort((a, b) => {
      const pick = (it: (typeof enriched)[number]) =>
        sortBy === 'ordersCount'
          ? it.ordersCount
          : sortBy === 'totalSpent'
            ? it.totalSpent
            : it.lastOrderAt
              ? new Date(it.lastOrderAt).getTime()
              : 0;
      const diff = pick(b) - pick(a);
      return sortOrder === 'desc' ? diff : -diff;
    });

    return {
      users: enriched.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Полная карточка пользователя: профиль, адрес, заказы со составом, отзывы.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        avatarUrl: true,
        birthdate: true,
        socialContact: true,
        // Адрес
        street: true,
        apartment: true,
        postalCode: true,
        countryName: true,
        cityName: true,
        deliveryType: true,
        cdekCityCode: true,
        cdekCountryCode: true,
        cdekRegionCode: true,
        cdekPickupPointCode: true,
        // Даты
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true, cartItems: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь ${id} не найден`);
    }

    const [ordersAgg, orders, reviews, cartItemsCount] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: id, isPaid: true, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          isPaid: true,
          paymentMethod: true,
          total: true,
          currency: true,
          deliveryType: true,
          cdekStatus: true,
          cdekStatusName: true,
          createdAt: true,
          items: {
            select: {
              productId: true,
              name: true,
              size: true,
              quantity: true,
              price: true,
              discount: true,
            },
          },
        },
      }),
      this.prisma.review.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          productId: true,
          rating: true,
          text: true,
          status: true,
          createdAt: true,
        },
      }),
      user._count.cartItems,
    ]);

    const lastOrder = orders[0];

    // Подтягиваем slug/name товаров для отзывов
    const reviewProductIds = Array.from(new Set(reviews.map((r) => r.productId)));
    const products = reviewProductIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: reviewProductIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      birthdate: user.birthdate,
      socialContact: user.socialContact,
      address: {
        street: user.street,
        apartment: user.apartment,
        postalCode: user.postalCode,
        countryName: user.countryName,
        cityName: user.cityName,
      },
      delivery: {
        deliveryType: user.deliveryType,
        cdekCityCode: user.cdekCityCode,
        cdekCountryCode: user.cdekCountryCode,
        cdekRegionCode: user.cdekRegionCode,
        cdekPickupPointCode: user.cdekPickupPointCode,
      },
      stats: {
        ordersCount: user._count.orders,
        cartItemsCount,
        totalSpent: ordersAgg._sum.total ?? 0,
        lastOrderAt: lastOrder ? lastOrder.createdAt : null,
      },
      orders,
      reviews: reviews.map((r) => ({
        ...r,
        product: productMap.get(r.productId) ?? null,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Удалить пользователя.
   * Заказы остаются как гостевые (userId = null).
   */
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Пользователь ${id} не найден`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await tx.review.updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await tx.user.delete({ where: { id } });
    });

    this.logger.warn(`Пользователь удалён: ${id} (${user.email})`);
    return {
      success: true,
      message: 'Пользователь удалён, заказы и отзывы сохранены (userId = null)',
    };
  }

  /**
   * Статистика по пользователям
   */
  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, newToday, newThisMonth, withOrders] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.user.count({ where: { orders: { some: {} } } }),
    ]);

    return {
      total,
      newToday,
      newThisMonth,
      withOrders,
      withoutOrders: total - withOrders,
    };
  }

  // ================= HELPERS =================

  private readonly listSelect = {
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      socialContact: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  };

  /**
   * totalSpent + lastOrderAt одним махом — через groupBy.
   * Возвращаем Map<userId, {totalSpent, lastOrderAt}>.
   */
  private async fetchAggregatesForUsers(userIds: string[]) {
    if (userIds.length === 0) {
      return new Map<string, { totalSpent: number; lastOrderAt: Date | null }>();
    }

    const grouped = await this.prisma.order.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        isPaid: true,
        status: { not: 'CANCELLED' },
      },
      _sum: { total: true },
      _max: { createdAt: true },
    });

    const map = new Map<string, { totalSpent: number; lastOrderAt: Date | null }>();
    for (const row of grouped) {
      if (!row.userId) continue;
      map.set(row.userId, {
        totalSpent: row._sum.total ?? 0,
        lastOrderAt: row._max.createdAt,
      });
    }
    return map;
  }

  private toListItem(
    u: {
      id: string;
      email: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      avatarUrl: string | null;
      socialContact: string | null;
      createdAt: Date;
      _count: { orders: number };
    },
    aggregates: Map<string, { totalSpent: number; lastOrderAt: Date | null }>,
  ) {
    const agg = aggregates.get(u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      socialContact: u.socialContact,
      createdAt: u.createdAt,
      ordersCount: u._count.orders,
      totalSpent: agg?.totalSpent ?? 0,
      lastOrderAt: agg?.lastOrderAt ?? null,
    };
  }
}
