import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  pickMainImage,
  pickMainImageUrl,
} from '../../common/utils/product-image.util';

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
      const imageUrl = pickMainImage(product?.images);

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

  /**
   * Бизнес-метрики: рост выручки/заказов, средний чек, конверсия,
   * зависшие неоплаченные деньги, возвраты.
   */
  async getBusinessMetrics() {
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

    const paidFilter: Prisma.OrderWhereInput = {
      isPaid: true,
      status: { not: OrderStatus.CANCELLED },
    };

    const [
      revMonth,
      revPrevMonth,
      revWeek,
      revPrevWeek,
      ordersAllTotal,
      ordersPaidTotal,
      ordersMonthTotal,
      ordersMonthPaid,
      unpaidAgg,
      refundedAgg,
    ] = await Promise.all([
      // выручка + кол-во оплаченных за текущий месяц
      this.prisma.order.aggregate({
        where: { ...paidFilter, createdAt: { gte: startOfMonth } },
        _sum: { total: true },
        _avg: { total: true },
        _count: true,
      }),
      // прошлый месяц
      this.prisma.order.aggregate({
        where: {
          ...paidFilter,
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
        },
        _sum: { total: true },
        _count: true,
      }),
      // текущая неделя
      this.prisma.order.aggregate({
        where: { ...paidFilter, createdAt: { gte: startOfWeek } },
        _sum: { total: true },
        _count: true,
      }),
      // прошлая неделя
      this.prisma.order.aggregate({
        where: {
          ...paidFilter,
          createdAt: { gte: startOfPrevWeek, lt: startOfWeek },
        },
        _sum: { total: true },
        _count: true,
      }),
      // конверсия: все заказы всего
      this.prisma.order.count(),
      // оплаченные заказы всего
      this.prisma.order.count({ where: paidFilter }),
      // все заказы за месяц
      this.prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      // оплаченные заказы за месяц
      this.prisma.order.count({
        where: { ...paidFilter, createdAt: { gte: startOfMonth } },
      }),
      // неоплаченные зависшие (PENDING, isPaid=false)
      this.prisma.order.aggregate({
        where: { isPaid: false, status: OrderStatus.PENDING },
        _sum: { total: true },
        _count: true,
      }),
      // возвраты за всё время
      this.prisma.order.aggregate({
        where: { status: OrderStatus.REFUNDED },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    const curMonth = Math.round(revMonth._sum.total || 0);
    const prevMonth = Math.round(revPrevMonth._sum.total || 0);
    const curWeek = Math.round(revWeek._sum.total || 0);
    const prevWeek = Math.round(revPrevWeek._sum.total || 0);

    return {
      revenue: {
        currentMonth: curMonth,
        prevMonth,
        growthPercent: growth(curMonth, prevMonth),
        currentMonthOrders: revMonth._count,
        prevMonthOrders: revPrevMonth._count,
        currentWeek: curWeek,
        prevWeek,
        weekGrowthPercent: growth(curWeek, prevWeek),
        currentWeekOrders: revWeek._count,
        prevWeekOrders: revPrevWeek._count,
      },
      averageOrderValue: Math.round(revMonth._avg.total || 0),
      conversion: {
        total:
          ordersAllTotal > 0
            ? Math.round((ordersPaidTotal / ordersAllTotal) * 1000) / 10
            : 0,
        thisMonth:
          ordersMonthTotal > 0
            ? Math.round((ordersMonthPaid / ordersMonthTotal) * 1000) / 10
            : 0,
      },
      unpaid: {
        count: unpaidAgg._count,
        amount: Math.round(unpaidAgg._sum.total || 0),
      },
      refunded: {
        count: refundedAgg._count,
        amount: Math.round(refundedAgg._sum.total || 0),
      },
    };
  }

  /**
   * Складская аналитика по активным товарам.
   * stock — JSON {"размер": кол-во}, агрегируем в JS.
   */
  async getInventory(threshold = 5) {
    const [products, soldItems] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          stock: true,
          price: true,
          discount: true,
          images: true,
        },
      }),
      // productId'шники из оплаченных заказов
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          productId: { not: null },
          order: {
            isPaid: true,
            status: { not: OrderStatus.CANCELLED },
          },
        },
      }),
    ]);

    const soldProductIds = new Set(
      soldItems
        .map((i) => i.productId)
        .filter((id): id is number => id !== null),
    );

    const lowStock: Array<{
      id: number;
      name: string;
      slug: string;
      totalStock: number;
      imageUrl: string | null;
    }> = [];
    const outOfStock: Array<{
      id: number;
      name: string;
      slug: string;
      imageUrl: string | null;
    }> = [];

    let inventoryValue = 0;
    let totalUnits = 0;
    let productsWithoutSales = 0;

    for (const p of products) {
      const totalStock = sumStock(p.stock);
      totalUnits += totalStock;

      const finalPrice = Math.floor(p.price - (p.price * p.discount) / 100);
      inventoryValue += totalStock * finalPrice;

      if (!soldProductIds.has(p.id)) {
        productsWithoutSales += 1;
      }

      if (totalStock === 0) {
        outOfStock.push({
          id: p.id,
          name: p.name,
          slug: p.slug,
          imageUrl: pickMainImageUrl(p.images),
        });
      } else if (totalStock <= threshold) {
        lowStock.push({
          id: p.id,
          name: p.name,
          slug: p.slug,
          totalStock,
          imageUrl: pickMainImageUrl(p.images),
        });
      }
    }

    // Сортировка lowStock по возрастанию остатка (самые критичные сверху)
    lowStock.sort((a, b) => a.totalStock - b.totalStock);

    return {
      threshold,
      inventoryValue: Math.round(inventoryValue),
      totalUnits,
      productsWithoutSales,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      lowStock: lowStock.slice(0, 50),
      outOfStock: outOfStock.slice(0, 50),
    };
  }

  /**
   * Разбивка заказов по статусу / способу оплаты / типу доставки.
   */
  async getOrdersBreakdown() {
    const paidFilter: Prisma.OrderWhereInput = {
      isPaid: true,
      status: { not: OrderStatus.CANCELLED },
    };

    const [byStatusRaw, byPaymentRaw, byDeliveryRaw] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { total: true },
        orderBy: { _count: { status: 'desc' } },
      }),
      this.prisma.order.groupBy({
        by: ['paymentMethod'],
        where: paidFilter,
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['deliveryType'],
        _count: { _all: true },
      }),
    ]);

    return {
      byStatus: byStatusRaw.map((r) => ({
        status: r.status,
        count: r._count._all,
        revenue: Math.round(r._sum.total || 0),
      })),
      byPaymentMethod: byPaymentRaw
        .map((r) => ({
          method: r.paymentMethod,
          count: r._count._all,
          revenue: Math.round(r._sum.total || 0),
        }))
        .sort((a, b) => b.count - a.count),
      byDeliveryType: byDeliveryRaw
        .map((r) => ({
          type: r.deliveryType,
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Активность: отзывы на модерации, подписчики рассылки,
   * корзины (прокси брошенных), новые пользователи.
   */
  async getActivity() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      reviewsPending,
      reviewsApproved,
      reviewsRejected,
      reviewsTotal,
      activeSubscribers,
      newSubscribers,
      distinctCartUsers,
      itemsInCarts,
      usersToday,
      usersWeek,
      usersMonth,
    ] = await Promise.all([
      this.prisma.review.count({ where: { status: 'PENDING' } }),
      this.prisma.review.count({ where: { status: 'APPROVED' } }),
      this.prisma.review.count({ where: { status: 'REJECTED' } }),
      this.prisma.review.count(),
      this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
      this.prisma.newsletterSubscriber.count({
        where: { isActive: true, subscribedAt: { gte: startOfMonth } },
      }),
      this.prisma.cartItem.groupBy({ by: ['userId'] }),
      this.prisma.cartItem.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);

    return {
      reviews: {
        pending: reviewsPending,
        approved: reviewsApproved,
        rejected: reviewsRejected,
        total: reviewsTotal,
      },
      newsletter: {
        activeSubscribers,
        newThisMonth: newSubscribers,
      },
      carts: {
        activeCarts: distinctCartUsers.length,
        itemsInCarts,
      },
      newUsers: {
        today: usersToday,
        thisWeek: usersWeek,
        thisMonth: usersMonth,
      },
    };
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Рост в %: ((cur - prev) / prev) * 100, округлённый до 0.1.
 * Если prev === 0 — null (рост от нуля посчитать нельзя).
 */
function growth(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/**
 * Суммарный остаток товара по всем размерам из JSON stock {"S":10,"M":0}.
 */
function sumStock(stock: unknown): number {
  if (!stock || typeof stock !== 'object' || Array.isArray(stock)) return 0;
  let total = 0;
  for (const v of Object.values(stock as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}
