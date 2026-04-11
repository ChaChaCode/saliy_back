import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';

interface FindAllParams {
  status?: OrderStatus;
  isPaid?: boolean;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Получить список всех заказов с фильтрами
   */
  async findAll(params: FindAllParams) {
    const {
      status,
      isPaid,
      search,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = params;

    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;
    if (isPaid !== undefined) where.isPaid = isPaid;

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { slug: true, images: true } },
            },
          },
          promoCodeUsages: {
            include: {
              promoCode: { select: { code: true, type: true, value: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map((order) => this.formatOrder(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Получить заказ по номеру (полная инфа)
   */
  async findByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: { select: { slug: true, images: true } },
          },
        },
        promoCodeUsages: {
          include: {
            promoCode: { select: { code: true, type: true, value: true } },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }

    return this.formatOrder(order);
  }

  /**
   * Изменить статус заказа
   */
  async updateStatus(orderNumber: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });

    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Нельзя изменить статус отменённого заказа');
    }

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: { status },
    });

    this.logger.log(`Статус заказа ${orderNumber} изменён на ${status}`);

    return updated;
  }

  /**
   * Отменить заказ + вернуть остатки на склад
   */
  async cancelOrder(orderNumber: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Заказ уже отменён');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Нельзя отменить доставленный заказ');
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      // Возвращаем остатки на склад
      for (const item of order.items) {
        if (!item.productId || !item.size) continue;

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) continue;

        const stock = (product.stock as any) || {};
        const currentStock = stock[item.size] || 0;
        const newStock = { ...stock, [item.size]: currentStock + item.quantity };

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: newStock,
            salesCount: { decrement: item.quantity },
          },
        });
      }

      return tx.order.update({
        where: { orderNumber },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    this.logger.log(
      `Заказ ${orderNumber} отменён${reason ? `, причина: ${reason}` : ''}`,
    );

    return cancelled;
  }

  /**
   * Обновить произвольные поля заказа
   */
  async updateOrder(orderNumber: string, data: Prisma.OrderUpdateInput) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });
    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data,
    });

    this.logger.log(`Заказ ${orderNumber} обновлён (общие поля)`);
    return updated;
  }

  /**
   * Обновить CDEK-информацию заказа вручную
   */
  async updateCdekInfo(
    orderNumber: string,
    data: {
      cdekNumber?: string;
      cdekUuid?: string;
      cdekStatus?: string;
      cdekStatusName?: string;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });
    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: {
        ...data,
        ...(data.cdekStatus && { cdekStatusDate: new Date() }),
      },
    });

    this.logger.log(`CDEK-инфо обновлена для ${orderNumber}`);
    return updated;
  }

  /**
   * Оформить возврат
   */
  async refundOrder(orderNumber: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });
    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }
    if (!order.isPaid) {
      throw new BadRequestException('Нельзя вернуть неоплаченный заказ');
    }
    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('Заказ уже возвращён');
    }

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: {
        status: OrderStatus.REFUNDED,
        comment: order.comment
          ? `${order.comment}\n\n[ВОЗВРАТ]: ${reason}`
          : `[ВОЗВРАТ]: ${reason}`,
      },
    });

    this.logger.warn(`Заказ ${orderNumber} возвращён: ${reason}`);
    return updated;
  }

  /**
   * Отправить произвольное email клиенту по заказу
   */
  async sendCustomEmail(orderNumber: string, subject: string, message: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { email: true, firstName: true, orderNumber: true },
    });
    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Здравствуйте, ${order.firstName}!</h2>
        <p>По вашему заказу <strong>#${order.orderNumber}</strong>:</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${message}</div>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">— Команда Saliy Clothes</p>
      </div>
    `;

    await this.emailService.sendRaw(order.email, subject, html);
    this.logger.log(`Письмо отправлено клиенту заказа ${orderNumber}`);

    return { success: true, sentTo: order.email };
  }

  /**
   * Экспорт заказов в CSV
   */
  async exportToCsv(params: FindAllParams): Promise<string> {
    const { orders } = await this.findAll({ ...params, limit: 10000, page: 1 });

    const header = [
      'Номер заказа',
      'Дата',
      'Клиент',
      'Email',
      'Телефон',
      'Статус',
      'Оплачен',
      'Товаров',
      'Сумма',
      'Валюта',
      'Доставка',
      'Промокод',
    ].join(';');

    const rows = orders.map((o: any) => {
      const customer = `${o.firstName} ${o.lastName}`.replace(/;/g, ',');
      const items = o.items?.length || 0;
      const promo = o.promoCode?.code || '';
      return [
        o.orderNumber,
        new Date(o.createdAt).toISOString(),
        customer,
        o.email,
        o.phone,
        o.status,
        o.isPaid ? 'да' : 'нет',
        items,
        o.total,
        o.currency,
        o.deliveryType,
        promo,
      ].join(';');
    });

    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /**
   * Статистика заказов
   */
  async getStats() {
    const [
      totalOrders,
      paidOrders,
      totalRevenue,
      byStatus,
      todayOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { isPaid: true } }),
      this.prisma.order.aggregate({
        where: { isPaid: true, status: { not: OrderStatus.CANCELLED } },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      totalOrders,
      paidOrders,
      todayOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      byStatus: byStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count }),
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * Форматирование заказа (общий метод)
   */
  private formatOrder(order: any) {
    const formattedItems = order.items.map((item: any) => {
      const images = item.product?.images as any;
      const imageUrl =
        Array.isArray(images) && images.length > 0 ? images[0] : null;
      const finalPrice = Math.floor(
        item.price - (item.price * item.discount) / 100,
      );

      return {
        id: item.id,
        productId: item.productId,
        name: item.name,
        slug: item.product?.slug || null,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        finalPrice,
        totalPrice: finalPrice * item.quantity,
        imageUrl,
      };
    });

    const originalSubtotal = formattedItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );

    return {
      ...order,
      items: formattedItems,
      originalSubtotal,
      promoCode:
        order.promoCodeUsages?.length > 0
          ? order.promoCodeUsages[0].promoCode
          : null,
    };
  }
}
