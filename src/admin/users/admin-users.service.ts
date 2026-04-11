import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface FindAllParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список пользователей с фильтрами
   */
  async findAll(params: FindAllParams) {
    const { search, dateFrom, dateTo, page = 1, limit = 20 } = params;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          socialContact: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        avatarUrl: u.avatarUrl,
        socialContact: u.socialContact,
        createdAt: u.createdAt,
        ordersCount: u._count.orders,
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
   * Получить пользователя по ID с историей заказов
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            isPaid: true,
            total: true,
            currency: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { orders: true, cartItems: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь ${id} не найден`);
    }

    const totalSpent = await this.prisma.order.aggregate({
      where: { userId: id, isPaid: true, status: { not: 'CANCELLED' } },
      _sum: { total: true },
    });

    return {
      ...user,
      ordersCount: user._count.orders,
      cartItemsCount: user._count.cartItems,
      totalSpent: totalSpent._sum.total || 0,
    };
  }

  /**
   * Удалить пользователя
   * Cascade удалит: refreshTokens, verificationCodes, cartItems
   * Заказы сохраняются как гостевые (userId = null)
   */
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь ${id} не найден`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Отвязываем заказы — сохраняются как гостевые
      await tx.order.updateMany({
        where: { userId: id },
        data: { userId: null },
      });

      await tx.user.delete({ where: { id } });
    });

    this.logger.warn(`Пользователь удалён: ${id} (${user.email})`);

    return { success: true, message: 'Пользователь удалён, заказы сохранены как гостевые' };
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
}
