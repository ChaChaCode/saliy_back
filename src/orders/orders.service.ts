import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './orders.dto';
import { EmailService } from '../common/email/email.service';
import { PromoService } from '../promo/promo.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => PromoService))
    private readonly promoService: PromoService,
  ) {}

  /**
   * Создать заказ (для гостей и авторизованных)
   * ВАЖНО: Валидация товаров и цен на сервере!
   */
  async createOrder(dto: CreateOrderDto, userId?: string) {
    const { items, promoCode, ...orderInfo } = dto;

    // 🔒 ШАГ 1: ВАЛИДАЦИЯ ТОВАРОВ И НАЛИЧИЯ НА СКЛАДЕ
    const validatedItems = await this.validateOrderItems(items);

    // 🔒 ШАГ 2: РАСЧЕТ СТОИМОСТИ (цены из БД, не от клиента!)
    const subtotal = validatedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    // 🔒 ШАГ 3: ПРИМЕНЕНИЕ ПРОМОКОДА (если есть)
    let discountAmount = 0;
    let promoCodeId: number | undefined;
    if (promoCode) {
      const promoResult = await this.applyPromoCode(
        promoCode,
        subtotal,
        validatedItems,
        userId,
      );
      discountAmount = promoResult.discountAmount;
      promoCodeId = promoResult.promoCodeId;
    }

    // 🔒 ШАГ 4: РАСЧЕТ ДОСТАВКИ
    const deliveryPrice = await this.calculateDeliveryPrice(
      dto.deliveryType,
      dto.cdekCityCode,
    );

    // 🔒 ШАГ 5: ИТОГОВАЯ СУММА
    const total = subtotal - discountAmount + deliveryPrice;

    // 🔒 ШАГ 6: СОЗДАНИЕ ЗАКАЗА В ТРАНЗАКЦИИ
    const order = await this.prisma.$transaction(async (tx) => {
      // Генерируем номер заказа
      const orderNumber = await this.generateOrderNumber();

      // Создаем заказ
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          ...(userId && { userId }),
          ...orderInfo,
          subtotal,
          discountAmount,
          deliveryTotal: deliveryPrice,
          total,
          status: OrderStatus.CONFIRMED, // Сразу оплачен и подтвержден
          isPaid: true,   // Оплачен
          currency: 'RUB',
          // Создаем элементы заказа (со снэпшотом цен)
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              name: item.productName,
              size: item.size,
              color: item.color,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
            })),
          },
        } as any,
        include: {
          items: true,
        },
      });

      // 🔒 ШАГ 7: УМЕНЬШЕНИЕ ОСТАТКОВ НА СКЛАДЕ
      for (const item of validatedItems) {
        await this.decreaseStock(tx, item.productId, item.size, item.quantity);
      }

      return newOrder;
    });

    this.logger.log(
      `Заказ создан: ${order.orderNumber}, товаров: ${items.length}, сумма: ${total} RUB`,
    );

    // 🔒 ШАГ 8: ЗАПИСЬ ИСПОЛЬЗОВАНИЯ ПРОМОКОДА
    if (promoCodeId) {
      await this.promoService.usePromoCode(promoCodeId, userId, order.id);
      this.logger.log(`Промокод записан в историю использования для заказа ${order.orderNumber}`);
    }

    // 🔒 ШАГ 9: ОТПРАВКА EMAIL УВЕДОМЛЕНИЯ
    try {
      // Отправляем подтверждение заказа
      await this.emailService.sendOrderConfirmation(orderInfo.email, {
        orderNumber: order.orderNumber,
        firstName: orderInfo.firstName,
        lastName: orderInfo.lastName,
        items: validatedItems.map((item) => ({
          name: item.productName,
          size: item.size,
          quantity: item.quantity,
          price: item.finalPrice,
        })),
        subtotal,
        deliveryPrice,
        total,
      });

      this.logger.log(`Email уведомление отправлено: ${orderInfo.email}`);
    } catch (error) {
      this.logger.error(`Не удалось отправить email: ${error.message}`);
      // Не падаем, заказ уже создан
    }

    return order;
  }

  /**
   * 💰 РАССЧИТАТЬ СТОИМОСТЬ ЗАКАЗА (без создания заказа)
   * Используется для отображения итоговой суммы перед кнопкой "Оплатить"
   */
  async calculateOrder(dto: CreateOrderDto) {
    const { items, promoCode, deliveryType, cdekCityCode } = dto;

    // 🔒 ШАГ 1: ВАЛИДАЦИЯ ТОВАРОВ И НАЛИЧИЯ НА СКЛАДЕ
    const validatedItems = await this.validateOrderItems(items);

    // 🔒 ШАГ 2: РАСЧЕТ СТОИМОСТИ (цены из БД, не от клиента!)
    const subtotal = validatedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    // 🔒 ШАГ 3: ПРИМЕНЕНИЕ ПРОМОКОДА (если есть)
    let discountAmount = 0;
    if (promoCode) {
      const promoResult = await this.applyPromoCode(
        promoCode,
        subtotal,
        validatedItems,
        undefined, // userId не передается в calculateOrder
      );
      discountAmount = promoResult.discountAmount;
    }

    // 🔒 ШАГ 4: РАСЧЕТ ДОСТАВКИ
    const deliveryPrice = await this.calculateDeliveryPrice(
      deliveryType,
      cdekCityCode,
    );

    // 🔒 ШАГ 5: ИТОГОВАЯ СУММА
    const total = subtotal - discountAmount + deliveryPrice;

    return {
      items: validatedItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        finalPrice: item.finalPrice,
        totalPrice: item.totalPrice,
        imageUrl: item.imageUrl,
      })),
      subtotal,
      discountAmount,
      deliveryPrice,
      total,
      currency: 'RUB',
    };
  }

  /**
   * 🔒 ВАЛИДАЦИЯ ТОВАРОВ ПЕРЕД ЗАКАЗОМ
   * Проверяет наличие, активность и остатки на складе
   */
  private async validateOrderItems(items: { productId: number; size: string; quantity: number }[]) {
    const validatedItems: any[] = [];

    for (const item of items) {
      // Получаем товар из БД
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new BadRequestException(
          `Товар с ID ${item.productId} не найден`,
        );
      }

      if (!product.isActive) {
        throw new BadRequestException(
          `Товар "${product.name}" недоступен для заказа`,
        );
      }

      // 🔒 ПРОВЕРКА ОСТАТКОВ НА СКЛАДЕ
      const stock = product.stock as any;
      const availableQuantity = stock[item.size] || 0;

      if (availableQuantity < item.quantity) {
        throw new BadRequestException(
          `Недостаточно товара "${product.name}" размера ${item.size}. ` +
          `Запрошено: ${item.quantity}, доступно: ${availableQuantity}`,
        );
      }

      // 🔒 ЦЕНЫ БЕРЕМ ИЗ БД, А НЕ ОТ КЛИЕНТА!
      const price = product.price;
      const discount = product.discount;
      const finalPrice = Math.floor(price - (price * discount) / 100);
      const totalPrice = finalPrice * item.quantity;

      // Получаем первое изображение товара
      const images = product.images as any;
      const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : null;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        color: product.color,
        size: item.size,
        quantity: item.quantity,
        price,
        discount,
        finalPrice,
        totalPrice,
        imageUrl,
      });
    }

    return validatedItems;
  }

  /**
   * 🔒 УМЕНЬШЕНИЕ ОСТАТКОВ НА СКЛАДЕ
   */
  private async decreaseStock(
    tx: any,
    productId: number,
    size: string,
    quantity: number,
  ) {
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    const stock = product.stock as any;
    const currentStock = stock[size] || 0;

    if (currentStock < quantity) {
      throw new BadRequestException(
        `Недостаточно товара на складе (race condition). ` +
        `Доступно: ${currentStock}, запрошено: ${quantity}`,
      );
    }

    // Обновляем остатки
    const newStock = { ...stock };
    newStock[size] = currentStock - quantity;

    await tx.product.update({
      where: { id: productId },
      data: {
        stock: newStock,
        salesCount: { increment: quantity },
      },
    });

    this.logger.log(
      `Остатки обновлены: товар ${productId}, размер ${size}: ${currentStock} -> ${newStock[size]}`,
    );
  }

  /**
   * Применить промокод
   */
  private async applyPromoCode(
    code: string,
    subtotal: number,
    validatedItems: any[],
    userId?: string,
  ): Promise<{ discountAmount: number; promoCodeId?: number }> {
    // Валидируем промокод
    const result = await this.promoService.validatePromoCode(
      {
        code,
        orderAmount: subtotal,
        cartItems: validatedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.finalPrice,
        })),
      },
      userId,
    );

    if (!result.isValid) {
      throw new BadRequestException(result.message || 'Промокод недействителен');
    }

    this.logger.log(
      `Промокод ${code} применен: скидка ${result.discount} ₽`,
    );

    return {
      discountAmount: result.discount,
      promoCodeId: result.promoCode?.id,
    };
  }

  /**
   * Рассчитать стоимость доставки
   */
  private async calculateDeliveryPrice(
    deliveryType: string,
    cdekCityCode?: number,
  ): Promise<number> {
    // TODO: Интеграция с CDEK API для расчета доставки
    if (deliveryType === 'CDEK') {
      return 500; // Временно фиксированная цена
    }
    return 0; // POST - бесплатно (или рассчитывать отдельно)
  }

  /**
   * Генерировать уникальный номер заказа
   */
  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    // Получаем количество заказов за сегодня
    const count = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        },
      },
    });

    const orderNum = (count + 1).toString().padStart(4, '0');
    return `${year}${month}${day}-${orderNum}`;
  }

  /**
   * Получить заказ по номеру
   */
  async getOrderByNumber(orderNumber: string) {
    return this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
      },
    });
  }

  /**
   * Получить заказы пользователя
   */
  async getUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Обновить статус оплаты заказа
   */
  async updatePaymentStatus(orderNumber: string, paymentStatus: string) {
    const statusMap: Record<string, string> = {
      PENDING: 'PENDING',
      CAPTURED: 'PAID',
      FAILED: 'FAILED',
      CANCELED: 'CANCELED',
    };

    const orderStatus = statusMap[paymentStatus] || 'PENDING';
    const isPaid = paymentStatus === 'CAPTURED';

    const order = await this.prisma.order.update({
      where: { orderNumber },
      data: {
        status: orderStatus as any,
        isPaid,
      },
    });

    this.logger.log(
      `Статус заказа обновлен: ${orderNumber}, status=${orderStatus}, isPaid=${isPaid}`,
    );

    return order;
  }
}
