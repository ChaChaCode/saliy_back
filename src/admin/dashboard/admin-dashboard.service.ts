import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Period = 'day' | 'week' | 'month' | 'year';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Общая сводка — всё для главной админки
   */
  async getOverview() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const paidFilter: Prisma.OrderWhereInput = {
      isPaid: true,
      status: { not: OrderStatus.CANCELLED },
    };

    const [
      revenueTotal,
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueYear,
      ordersTotal,
      ordersToday,
      ordersWeek,
      ordersMonth,
      pendingOrders,
      usersTotal,
      usersToday,
      usersMonth,
      activeProducts,
      totalProducts,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: paidFilter,
        _sum: { total: true },
        _avg: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { ...paidFilter, createdAt: { gte: startOfDay } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { ...paidFilter, createdAt: { gte: startOfWeek } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { ...paidFilter, createdAt: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { ...paidFilter, createdAt: { gte: startOfYear } },
        _sum: { total: true },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count(),
    ]);

    return {
      revenue: {
        total: revenueTotal._sum.total || 0,
        today: revenueToday._sum.total || 0,
        thisWeek: revenueWeek._sum.total || 0,
        thisMonth: revenueMonth._sum.total || 0,
        thisYear: revenueYear._sum.total || 0,
        averageOrderValue: Math.round(revenueTotal._avg.total || 0),
      },
      orders: {
        total: ordersTotal,
        today: ordersToday,
        thisWeek: ordersWeek,
        thisMonth: ordersMonth,
        pending: pendingOrders,
      },
      users: {
        total: usersTotal,
        today: usersToday,
        thisMonth: usersMonth,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
        inactive: totalProducts - activeProducts,
      },
    };
  }

  /**
   * График выручки по периодам
   */
  async getRevenueChart(period: Period = 'month') {
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;

    switch (period) {
      case 'day':
        // Последние 24 часа, группировка по часу
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupFormat = 'hour';
        break;
      case 'week':
        // Последние 7 дней, группировка по дню
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupFormat = 'day';
        break;
      case 'year':
        // Последние 12 месяцев, группировка по месяцу
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        groupFormat = 'month';
        break;
      case 'month':
      default:
        // Последние 30 дней, группировка по дню
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupFormat = 'day';
        break;
    }

    const orders = await this.prisma.order.findMany({
      where: {
        isPaid: true,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Группировка
    const grouped = new Map<string, { revenue: number; orders: number }>();

    for (const order of orders) {
      let key: string;
      const d = order.createdAt;

      if (groupFormat === 'hour') {
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
      } else if (groupFormat === 'day') {
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      } else {
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      }

      const existing = grouped.get(key) || { revenue: 0, orders: 0 };
      existing.revenue += order.total;
      existing.orders += 1;
      grouped.set(key, existing);
    }

    return {
      period,
      startDate,
      endDate: now,
      data: Array.from(grouped.entries()).map(([date, stats]) => ({
        date,
        revenue: stats.revenue,
        orders: stats.orders,
      })),
    };
  }

  /**
   * Топ продаваемых товаров
   */
  async getTopProducts(limit = 10) {
    // Группировка по productId в OrderItem из оплаченных заказов
    const topItems = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { not: null },
        order: {
          isPaid: true,
          status: { not: OrderStatus.CANCELLED },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: { quantity: 'desc' },
      },
      take: limit,
    });

    // Получаем инфу о товарах
    const productIds = topItems
      .map((item) => item.productId)
      .filter((id): id is number => id !== null);

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        discount: true,
        images: true,
        isActive: true,
      },
    });

    // Считаем выручку по каждому товару
    const revenueByProduct = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: {
          isPaid: true,
          status: { not: OrderStatus.CANCELLED },
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const revenueMap = new Map<number, number>();
    for (const item of revenueByProduct) {
      if (item.productId === null) continue;
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      const finalPrice = Math.floor(
        product.price - (product.price * product.discount) / 100,
      );
      revenueMap.set(item.productId, finalPrice * (item._sum.quantity || 0));
    }

    return topItems.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const images = (product?.images as any) || [];
      const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : null;

      return {
        productId: item.productId,
        name: product?.name || 'Товар удалён',
        slug: product?.slug || null,
        price: product?.price || 0,
        isActive: product?.isActive || false,
        imageUrl,
        soldCount: item._sum.quantity || 0,
        revenue: revenueMap.get(item.productId as number) || 0,
      };
    });
  }

  /**
   * Последние заказы
   */
  async getRecentOrders(limit = 10) {
    const orders = await this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        isPaid: true,
        total: true,
        currency: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: `${o.firstName} ${o.lastName}`,
      email: o.email,
      status: o.status,
      isPaid: o.isPaid,
      total: o.total,
      currency: o.currency,
      itemsCount: o._count.items,
      createdAt: o.createdAt,
    }));
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
