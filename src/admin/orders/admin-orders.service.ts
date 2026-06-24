import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { pickMainImage } from '../../common/utils/product-image.util';

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
    private readonly deliveryService: DeliveryService,
  ) {}

  /**
   * Попросить CDEK отдать актуальный статус по заказу и записать в БД.
   * Прокси к DeliveryService.refreshCdekStatusForOrder, чтобы вызывать из админ-контроллера.
   */
  async refreshCdekStatus(orderNumber: string) {
    return this.deliveryService.refreshCdekStatusForOrder(orderNumber);
  }

  /**
   * Создать накладную CDEK для существующего заказа (ручной/разовый вызов из админки).
   * Для заказов, оплаченных до автосоздания, или если накладная не создалась.
   */
  async createCdekInvoice(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }
    if (order.deliveryType !== 'CDEK_PICKUP') {
      throw new BadRequestException('У заказа не CDEK-доставка');
    }
    if (order.cdekUuid) {
      throw new BadRequestException('Накладная CDEK уже создана');
    }
    if (!order.cdekCityCode) {
      throw new BadRequestException('У заказа нет кода города CDEK');
    }

    const result = await this.deliveryService.createCdekOrder({
      orderNumber: order.orderNumber,
      deliveryType: 'CDEK_PICKUP',
      recipient: {
        firstName: order.firstName,
        lastName: order.lastName,
        phone: order.phone,
        email: order.email,
      },
      address: {
        cityCode: order.cdekCityCode,
        postalCode: order.postalCode ?? undefined,
        pickupPointCode: order.pickupPoint ?? undefined,
      },
      items: order.items.map((item) => ({
        // Размер в названии — чтобы отправитель видел в накладной CDEK, что класть.
        name: item.size ? `${item.name} (${item.size})` : item.name,
        sku: item.productId != null ? String(item.productId) : item.name,
        quantity: item.quantity,
        price: item.price,
        weight: 200,
      })),
    });

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: {
        cdekUuid: result.uuid,
        ...(result.cdekNumber ? { cdekNumber: result.cdekNumber } : {}),
      },
    });
    this.logger.log(
      `Накладная CDEK создана вручную для ${orderNumber}: uuid=${result.uuid}`,
    );
    return updated;
  }

  /**
   * Создать накладные CDEK для всех оплаченных CDEK-заказов без накладной.
   * Разовая массовая операция (для заказов, оплаченных до автосоздания, или
   * если webhook/создание пропустилось). Возвращает сводку.
   */
  async createMissingCdekInvoices() {
    const orders = await this.prisma.order.findMany({
      where: {
        isPaid: true,
        deliveryType: 'CDEK_PICKUP',
        cdekUuid: null,
        cdekCityCode: { not: null },
      },
      select: { orderNumber: true },
    });

    const result = { total: orders.length, created: 0, failed: [] as string[] };
    for (const o of orders) {
      try {
        await this.createCdekInvoice(o.orderNumber);
        result.created++;
      } catch (error: any) {
        result.failed.push(`${o.orderNumber}: ${error.message}`);
      }
    }
    this.logger.log(
      `Массовое создание накладных CDEK: создано ${result.created}/${result.total}`,
    );
    return result;
  }

  /**
   * Получить PDF-квитанцию (накладную) CDEK по заказу.
   */
  async getWaybillPdf(orderNumber: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { cdekUuid: true },
    });
    if (!order) {
      throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    }
    if (!order.cdekUuid) {
      throw new BadRequestException(
        'Накладная CDEK ещё не создана для этого заказа',
      );
    }
    return this.deliveryService.getCdekWaybillPdf(order.cdekUuid);
  }

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
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
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
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason
            ? `Отменён администратором: ${reason}`
            : 'Отменён администратором',
        },
      });
    });

    this.logger.log(
      `Заказ ${orderNumber} отменён${reason ? `, причина: ${reason}` : ''}`,
    );

    return cancelled;
  }

  /**
   * Обновить произвольные поля заказа.
   * Если у заказа уже есть cdekUuid — параллельно пушим изменившиеся поля в CDEK.
   * При ошибке CDEK API (например, посылка уже в пути) — DB-обновление не откатываем,
   * только логируем. В ответе вернём флаг cdekSyncError если CDEK не принял.
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

    // Пуш изменений в CDEK
    let cdekSyncError: string | null = null;
    if (order.cdekUuid) {
      const patch = this.buildCdekPatch(order, updated, data);
      if (patch) {
        try {
          await this.deliveryService.updateCdekOrder(order.cdekUuid, patch);
        } catch (error: any) {
          cdekSyncError = error?.message || 'CDEK update failed';
          this.logger.warn(
            `Заказ ${orderNumber}: данные в БД обновлены, но CDEK отклонил изменение: ${cdekSyncError}`,
          );
        }
      }
    }

    return cdekSyncError ? { ...updated, cdekSyncError } : updated;
  }

  /**
   * Полностью заменить состав заказа (размер/кол-во/удалить/добавить).
   * В одной транзакции: возвращаем сток по старым позициям, валидируем и списываем
   * по новым (с проверкой наличия), пересоздаём order_items со снэпшотом цен из БД,
   * пересчитываем subtotal/total. Цены берём из БД (не от клиента).
   * Доставку и промокод-скидку не трогаем. Нельзя для отменённых/доставленных.
   */
  async updateOrderItems(
    orderNumber: string,
    newItems: Array<{ productId: number; size: string; quantity: number }>,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Заказ ${orderNumber} не найден`);
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        'Нельзя менять состав отменённого/возвращённого/доставленного заказа',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Возвращаем на склад товар по СТАРЫМ позициям
      for (const old of order.items) {
        if (old.productId == null || !old.size) continue;
        const p = await tx.product.findUnique({ where: { id: old.productId } });
        if (!p) continue;
        const stock = (p.stock as any) || {};
        stock[old.size] = (stock[old.size] || 0) + old.quantity;
        await tx.product.update({
          where: { id: old.productId },
          data: { stock, salesCount: { decrement: old.quantity } },
        });
      }

      // 2. Валидируем и списываем по НОВЫМ позициям, собираем снэпшот
      const itemsData: Array<{
        productId: number; name: string; sku: string | null; color: string | null;
        size: string; quantity: number; price: number; discount: number;
      }> = [];
      let subtotal = 0;

      for (const it of newItems) {
        const product = await tx.product.findFirst({
          where: { id: it.productId, deletedAt: null },
        });
        if (!product) {
          throw new BadRequestException(`Товар ${it.productId} не найден`);
        }
        const stock = (product.stock as any) || {};
        const available = stock[it.size] || 0;
        if (available < it.quantity) {
          throw new BadRequestException(
            `${product.name} (${it.size}): доступно только ${available} шт`,
          );
        }
        stock[it.size] = available - it.quantity;
        await tx.product.update({
          where: { id: product.id },
          data: { stock, salesCount: { increment: it.quantity } },
        });

        const finalPrice = Math.floor(
          product.price - (product.price * product.discount) / 100,
        );
        subtotal += finalPrice * it.quantity;
        itemsData.push({
          productId: product.id,
          name: product.name,
          sku: String(product.id),
          color: product.color,
          size: it.size,
          quantity: it.quantity,
          price: product.price,
          discount: product.discount,
        });
      }

      // 3. Пересоздаём позиции заказа
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.orderItem.createMany({
        data: itemsData.map((i) => ({ ...i, orderId: order.id })),
      });

      // 4. Пересчёт сумм (скидку промокода и доставку не трогаем)
      const total = subtotal - order.discountAmount + order.deliveryTotal;
      return tx.order.update({
        where: { id: order.id },
        data: { subtotal, total },
        include: { items: true },
      });
    });

    this.logger.log(
      `Состав заказа ${orderNumber} изменён: позиций ${updated.items.length}, total ${updated.total}`,
    );
    return updated;
  }

  /**
   * Сравнить старый/новый заказ и собрать diff для CDEK PATCH.
   * Возвращаем null если ни одного поля, релевантного для CDEK, не поменялось.
   */
  private buildCdekPatch(
    before: { firstName: string; lastName: string; phone: string; email: string; cdekCityCode: number | null; street: string | null; apartment: string | null; pickupPoint: string | null; comment: string | null; deliveryType: string },
    after: { firstName: string; lastName: string; phone: string; email: string; cdekCityCode: number | null; street: string | null; apartment: string | null; pickupPoint: string | null; comment: string | null; deliveryType: string },
    incoming: Prisma.OrderUpdateInput,
  ) {
    const patch: Parameters<DeliveryService['updateCdekOrder']>[1] = {};
    const touched = (key: keyof Prisma.OrderUpdateInput) => incoming[key] !== undefined;

    if (touched('firstName') || touched('lastName')) {
      patch.recipientName = `${after.firstName} ${after.lastName}`.trim();
    }
    if (touched('phone')) {
      patch.recipientPhone = after.phone;
    }
    if (touched('email')) {
      patch.recipientEmail = after.email;
    }
    if (touched('comment')) {
      patch.comment = after.comment ?? '';
    }

    if (after.deliveryType === 'CDEK_PICKUP' && touched('pickupPoint')) {
      if (after.pickupPoint) {
        patch.pickupPointCode = after.pickupPoint;
      }
    } else if (after.deliveryType === 'CDEK_COURIER') {
      const cityChanged = touched('cdekCityCode');
      const addressChanged = touched('street') || touched('apartment');
      if (cityChanged || addressChanged) {
        patch.toLocation = {};
        if (cityChanged && after.cdekCityCode) {
          patch.toLocation.cityCode = after.cdekCityCode;
        }
        if (addressChanged) {
          const parts = [after.street, after.apartment ? `кв. ${after.apartment}` : null]
            .filter(Boolean);
          if (parts.length) patch.toLocation.address = parts.join(', ');
        }
      }
    }

    return Object.keys(patch).length > 0 ? patch : null;
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
      const imageUrl = pickMainImage(item.product?.images);
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
      cdekTrackingUrl: order.cdekNumber
        ? this.deliveryService.getCdekTrackingUrl(order.cdekNumber)
        : null,
    };
  }
}
