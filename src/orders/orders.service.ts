import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './orders.dto';
import { EmailService } from '../common/email/email.service';
import { PromoService } from '../promo/promo.service';
import { CartService } from '../cart/cart.service';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';
import { AlfaPayService } from '../payment/alfa-pay.service';
import { pickMainImage } from '../common/utils/product-image.util';
import { YandexPayService } from '../payment/yandex-pay.service';
import { TochkaPayService } from '../payment/tochka-pay.service';
import { DeliveryService } from '../delivery/delivery.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly cartService: CartService,
    @Inject(forwardRef(() => PromoService))
    private readonly promoService: PromoService,
    private readonly settingsService: AdminSettingsService,
    @Inject(forwardRef(() => AlfaPayService))
    private readonly alfaPayService: AlfaPayService,
    @Inject(forwardRef(() => YandexPayService))
    private readonly yandexPayService: YandexPayService,
    @Inject(forwardRef(() => TochkaPayService))
    private readonly tochkaPayService: TochkaPayService,
    private readonly deliveryService: DeliveryService,
  ) {}

  /**
   * Создать заказ (для гостей и авторизованных)
   * ВАЖНО: Валидация товаров и цен на сервере!
   */
  async createOrder(dto: CreateOrderDto, userId?: string) {
    const { items, promoCode, ...orderInfo } = dto;

    // 🔒 ШАГ 0: ВАЛИДАЦИЯ АДРЕСА ДОСТАВКИ
    // Почтовая доставка (STANDARD): на чекауте есть страна, полный адрес и индекс —
    // требуем их и на сервере (не доверяем фронту). Самовывоз CDEK адрес не требует
    // (там код ПВЗ, адрес подтягиваем из CDEK ниже).
    if (dto.deliveryType === 'STANDARD') {
      const missing: string[] = [];
      if (!dto.countryName?.trim()) missing.push('страну');
      if (!dto.street?.trim()) missing.push('полный адрес');
      if (!dto.postalCode?.trim()) missing.push('почтовый индекс');
      if (missing.length > 0) {
        throw new BadRequestException(
          `Для почтовой доставки укажите: ${missing.join(', ')}`,
        );
      }
    }

    // 🔒 ШАГ 1: ВАЛИДАЦИЯ ТОВАРОВ И НАЛИЧИЯ НА СКЛАДЕ
    const validatedItems = await this.validateOrderItems(items);

    // 🔒 ШАГ 2: РАСЧЕТ СТОИМОСТИ (цены из БД, не от клиента!)
    const originalSubtotal = validatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
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
      validatedItems,
    );

    // ШАГ 4.5: АДРЕС ПВЗ ДЛЯ САМОВЫВОЗА CDEK
    // У самовывоза фронт присылает только код ПВЗ (pickupPoint) — улицы/города нет.
    // Подтягиваем адрес пункта из CDEK по коду, чтобы в админке и заказе был
    // читаемый адрес, а не код вида "CHEL47". Заполняем только пустые поля.
    if (dto.deliveryType === 'CDEK_PICKUP' && dto.pickupPoint) {
      try {
        const pvz = await this.deliveryService.getCdekPickupPointByCode(
          dto.pickupPoint,
        );
        if (pvz) {
          orderInfo.cityName = orderInfo.cityName || pvz.city || undefined;
          orderInfo.regionName = orderInfo.regionName || pvz.region || undefined;
          orderInfo.postalCode = orderInfo.postalCode || pvz.postalCode || undefined;
          orderInfo.street = orderInfo.street || pvz.addressFull || undefined;
        }
      } catch (error: any) {
        this.logger.error(
          `Не удалось подтянуть адрес ПВЗ ${dto.pickupPoint}: ${error.message}`,
        );
        // Не падаем — заказ оформится без адреса пункта
      }
    }

    // 🔒 ШАГ 5: ИТОГОВАЯ СУММА
    const total = subtotal - discountAmount + deliveryPrice;

    // Для онлайн-оплат (Alfa, Yandex Pay) заказ создаётся в PENDING.
    // Остальные методы (CARD_MANUAL, CRYPTO, PAYPAL) — помечаем оплаченным сразу.
    const isAlfaOnline = dto.paymentMethod === PaymentMethod.CARD_ONLINE;
    const isYandexPay = dto.paymentMethod === PaymentMethod.YANDEX_PAY;
    const isTochkaSbp = dto.paymentMethod === PaymentMethod.SBP_TOCHKA;
    const isOnlinePayment = isAlfaOnline || isYandexPay || isTochkaSbp;

    // Альфа (CARD_ONLINE) отключена. Не доверяем клиенту: даже если фронт пришлёт
    // этот метод, заказ оформить нельзя. Доступны только Точка и Яндекс Сплит.
    if (isAlfaOnline) {
      throw new BadRequestException('Этот способ оплаты недоступен');
    }

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
          status: isOnlinePayment ? OrderStatus.PENDING : OrderStatus.CONFIRMED,
          isPaid: !isOnlinePayment,
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

    // 🔒 ШАГ 8.5: РЕГИСТРАЦИЯ ПЛАТЕЖА (если оплата онлайн)
    let paymentUrl: string | null = null;
    if (isOnlinePayment) {
      const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
      const successUrl = `${frontendBase}/order/${order.orderNumber}?payment=success`;
      const failUrl = `${frontendBase}/order/${order.orderNumber}?payment=fail`;

      try {
        if (isAlfaOnline) {
          const alfa = await this.alfaPayService.registerOrder({
            orderNumber: order.orderNumber,
            amount: total,
            description: `Заказ ${order.orderNumber}`,
            email: orderInfo.email,
            returnUrl: successUrl,
            failUrl,
          });
          paymentUrl = alfa.formUrl;
          await this.prisma.order.update({
            where: { id: order.id },
            data: { paymentId: alfa.orderId },
          });
        } else if (isYandexPay) {
          // Яндекс требует cart.total = items_sum − discounts_sum.
          // Добавляем доставку отдельной строкой, промокод — через discount.
          const yandexItems = validatedItems.map((item) => ({
            productId: String(item.productId),
            title: item.productName,
            quantity: item.quantity,
            unitPrice: item.finalPrice,
          }));
          if (deliveryPrice > 0) {
            yandexItems.push({
              productId: `delivery-${order.orderNumber}`,
              title: 'Доставка',
              quantity: 1,
              unitPrice: deliveryPrice,
            });
          }

          const yandex = await this.yandexPayService.registerOrder({
            orderId: order.orderNumber,
            amount: total,
            description: `Заказ ${order.orderNumber}`,
            redirectUrl: successUrl,
            cancelUrl: failUrl,
            cartItems: yandexItems,
            ...(promoCode && discountAmount > 0
              ? { discount: { code: promoCode, amount: discountAmount } }
              : {}),
          });
          paymentUrl = yandex.paymentUrl;
          if (yandex.yandexOrderId) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: { paymentId: yandex.yandexOrderId },
            });
          }
        } else if (isTochkaSbp) {
          const tochka = await this.tochkaPayService.registerOrder({
            orderId: order.orderNumber,
            amount: total,
            description: `Заказ ${order.orderNumber}`,
            redirectUrl: successUrl,
            failRedirectUrl: failUrl,
            // Ссылка живёт меньше, чем заказ до автоотмены (запас на обработку платежа).
            ttlMinutes: this.getPaymentLinkTtlMin(),
          });
          paymentUrl = tochka.paymentUrl;
          if (tochka.operationId) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: { paymentId: tochka.operationId },
            });
          }
        }
      } catch (error: any) {
        this.logger.error(
          `Регистрация платежа (${dto.paymentMethod}) не удалась для ${order.orderNumber}: ${error.message}`,
        );
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAYMENT_FAILED,
            cancelReason: `Ошибка регистрации платежа (${dto.paymentMethod}): ${error.message}`.slice(0, 500),
          },
        });
        throw new BadRequestException(
          'Не удалось инициализировать платёж. Попробуйте позже.',
        );
      }
    }

    // 🔒 ШАГ 9: ОТПРАВКА EMAIL-ЧЕКА
    // Для онлайн-оплат (Точка, Яндекс) чек НЕ отправляем сейчас — заказ ещё PENDING,
    // иначе клиент получит «успешный» чек до фактической оплаты. Чек уйдёт из
    // updatePaymentStatus при подтверждении оплаты (webhook со статусом PAID).
    // Для остальных методов (CARD_MANUAL, CRYPTO, PAYPAL) отправляем сразу.
    if (!isOnlinePayment) {
      try {
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
          originalSubtotal,
          subtotal,
          discountAmount,
          promoCode: promoCode || null,
          deliveryPrice,
          total,
          paymentMethod: orderInfo.paymentMethod,
        });

        this.logger.log(`Email-чек отправлен: ${orderInfo.email}`);
      } catch (error) {
        this.logger.error(`Не удалось отправить email: ${error.message}`);
        // Не падаем, заказ уже создан
      }
    }

    // 🔒 ШАГ 10: ОЧИСТКА КОРЗИНЫ
    // Для онлайн-оплат (Альфа, Яндекс) очистка переехала в updatePaymentStatus —
    // корзина чистится ТОЛЬКО когда платёж подтверждён. Если клиент ушёл с формы
    // оплаты или платёж упал — корзина остаётся, чтобы можно было повторить заказ.
    if (userId && !isOnlinePayment) {
      try {
        await this.cartService.clearCart(userId);
        this.logger.log(`Корзина очищена для пользователя ${userId}`);
      } catch (error) {
        this.logger.error(`Не удалось очистить корзину: ${error.message}`);
        // Не падаем, заказ уже создан
      }
    }

    return {
      ...order,
      items: validatedItems.map((item) => ({
        productId: item.productId,
        name: item.productName,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        finalPrice: item.finalPrice,
        totalPrice: item.totalPrice,
        imageUrl: item.imageUrl,
      })),
      originalSubtotal,
      promoCode: promoCode ? { code: promoCode } : null,
      paymentUrl,
    };
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
    const originalSubtotal = validatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const subtotal = validatedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const productDiscountAmount = originalSubtotal - subtotal;

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
      validatedItems,
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
      originalSubtotal,
      productDiscountAmount,
      subtotal,
      discountAmount,
      promoCode: promoCode || null,
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
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, deletedAt: null },
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
          `${product.name} (${item.size}): доступно только ${availableQuantity} шт`,
        );
      }

      // 🔒 ЦЕНЫ БЕРЕМ ИЗ БД, А НЕ ОТ КЛИЕНТА!
      const price = product.price;
      const discount = product.discount;
      const finalPrice = Math.floor(price - (price * discount) / 100);
      const totalPrice = finalPrice * item.quantity;

      // Главное изображение товара (primary → preview → по order)
      const imageUrl = pickMainImage(product.images);

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
        weight: product.weight ?? 0, // в граммах
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
        `Товар закончился, доступно только ${currentStock} шт`,
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
   * Рассчитать стоимость доставки.
   * Для CDEK_PICKUP — реальный расчёт через CDEK API (city + weight).
   * При сбое API или отсутствии cdekCityCode — fallback на админскую настройку delivery_price_cdek.
   * STANDARD — фикс из настроек (CDEK не покрывает все международные страны).
   */
  private async calculateDeliveryPrice(
    deliveryType: string,
    cdekCityCode: number | undefined,
    validatedItems: Array<{ quantity: number; weight: number }>,
  ): Promise<number> {
    if (deliveryType === 'CDEK_PICKUP') {
      const fallback = await this.settingsService.getValue<number>(
        'delivery_price_cdek',
        500,
      );

      if (!cdekCityCode) {
        // На стадии "calculate" клиент мог ещё не выбрать ПВЗ → нет cityCode
        return fallback;
      }

      // Фиксированный вес посылки 500г для всех заказов (по требованию бизнеса)
      const weight = 500;

      try {
        const result = await this.deliveryService.calculateCdekDeliveryPrice(
          cdekCityCode,
          weight,
          'RUB',
        );
        const pickup = result?.pickup;
        const cdekPrice = pickup?.deliverySum;
        if (typeof cdekPrice === 'number' && cdekPrice >= 0) {
          this.logger.log(
            `CDEK price: city=${cdekCityCode}, weight=${weight}г → ${cdekPrice} ₽` +
              ` [тариф ${pickup!.tariffCode}: ${pickup!.tariffName}]`,
          );
          return cdekPrice;
        }
        this.logger.warn(
          `CDEK не вернул цену для city=${cdekCityCode}, использую fallback ${fallback} ₽`,
        );
        return fallback;
      } catch (error: any) {
        this.logger.warn(
          `Ошибка CDEK калькулятора (city=${cdekCityCode}): ${error.message}. Fallback ${fallback} ₽`,
        );
        return fallback;
      }
    }

    if (deliveryType === 'STANDARD') {
      return await this.settingsService.getValue<number>(
        'delivery_price_standard',
        800,
      );
    }

    return 0;
  }

  /**
   * Генерировать уникальный номер заказа
   * Формат: SALIYYYMMDDXXXXX (например: SALIY2603300001)
   */
  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const prefix = `SALIY${year}${month}${day}`;

    // Берём МАКСИМАЛЬНЫЙ существующий номер с этим префиксом и +1.
    // НЕ count() — иначе после удаления заказов номера переиспользуются
    // и упираются в unique-конфликт (duplicate key order_number).
    const last = await this.prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    const lastSeq = last
      ? parseInt(last.orderNumber.slice(prefix.length), 10) || 0
      : 0;
    const orderNum = (lastSeq + 1).toString().padStart(5, '0');
    return `${prefix}${orderNum}`;
  }

  /**
   * Получить заказ по номеру
   */
  async getOrderByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: {
              select: {
                slug: true,
                images: true,
              },
            },
          },
        },
        promoCodeUsages: {
          include: {
            promoCode: {
              select: {
                code: true,
                type: true,
                value: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    // Форматируем данные
    const formattedItems = order.items.map((item) => {
      const imageUrl = pickMainImage(item.product?.images);
      const finalPrice = Math.floor(item.price - (item.price * item.discount) / 100);

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
      (sum, item) => sum + item.price * item.quantity, 0,
    );

    return {
      ...order,
      items: formattedItems,
      originalSubtotal,
      promoCode: order.promoCodeUsages.length > 0
        ? order.promoCodeUsages[0].promoCode
        : null,
    };
  }

  /**
   * Получить заказы пользователя
   */
  async getUserOrders(userId: string, email?: string) {
    // Показываем заказы по владельцу (userId) И по почте пользователя —
    // чтобы гостевые заказы на эту же почту были видны сразу, даже если
    // привязка по userId ещё не выполнилась. Привязка при входе — подстраховка.
    const orders = await this.prisma.order.findMany({
      where: email
        ? { OR: [{ userId }, { email }] }
        : { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                slug: true,
                images: true,
              },
            },
          },
        },
        promoCodeUsages: {
          include: {
            promoCode: {
              select: {
                code: true,
                type: true,
                value: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Форматируем данные для удобства
    return orders.map((order) => {
      const formattedItems = order.items.map((item) => {
        const imageUrl = pickMainImage(item.product?.images);
        const finalPrice = Math.floor(item.price - (item.price * item.discount) / 100);

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
        (sum, item) => sum + item.price * item.quantity, 0,
      );

      return {
        ...order,
        items: formattedItems,
        originalSubtotal,
        promoCode: order.promoCodeUsages.length > 0
          ? order.promoCodeUsages[0].promoCode
          : null,
      };
    });
  }

  /**
   * Обновить статус оплаты заказа.
   * На вход — внутренний статус платежа (из AlfaPayService.getOrderStatus):
   * PENDING | PAID | FAILED | CANCELED | REFUNDED.
   */
  async updatePaymentStatus(
    orderNumber: string,
    paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED',
    rawStatus?: string,
  ) {
    const statusMap: Record<string, OrderStatus> = {
      PENDING: OrderStatus.PENDING,
      PAID: OrderStatus.CONFIRMED,
      FAILED: OrderStatus.PAYMENT_FAILED,
      CANCELED: OrderStatus.CANCELLED,
      REFUNDED: OrderStatus.REFUNDED,
    };

    const orderStatus = statusMap[paymentStatus] ?? OrderStatus.PENDING;
    const isPaid = paymentStatus === 'PAID';

    // Причина для неуспешных статусов — чтобы видеть в админке, почему не оплачено.
    const reasonMap: Record<string, string> = {
      FAILED: 'Платёж отклонён платёжной системой',
      CANCELED: 'Оплата отменена / истёк срок платёжной ссылки',
      REFUNDED: 'Оформлен возврат средств',
    };
    const cancelReason =
      reasonMap[paymentStatus] != null
        ? `${reasonMap[paymentStatus]}${rawStatus ? ` (статус: ${rawStatus})` : ''}`
        : undefined;

    // Запоминаем предыдущее состояние, чтобы понять — это ПЕРЕХОД в paid или повторный вебхук.
    const previous = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { isPaid: true, userId: true, status: true, items: true },
    });

    // ПЕРЕХОД В ОПЛАЧЕНО — атомарно, чтобы исключить TOCTOU-гонку webhook vs polling.
    // updateMany ... WHERE isPaid=false: побочки (чек/корзина/накладная) выполняет
    // ТОЛЬКО тот вызов, который реально перевёл заказ (count===1). Параллельный
    // второй вызов получит count===0 и побочки не продублирует.
    if (isPaid) {
      const transition = await this.prisma.order.updateMany({
        where: { orderNumber, isPaid: false },
        data: { status: orderStatus, isPaid: true, cancelReason: null },
      });

      if (transition.count === 0) {
        // Гонку проиграли или заказ уже оплачен — побочки не повторяем.
        return this.prisma.order.findUnique({ where: { orderNumber } });
      }

      // Мы — победитель перехода. Если заказ был отменён автоотменой (оплата пришла
      // после неё) — воскрешаем: пере-списываем товар, который вернули при отмене.
      if (previous?.status === OrderStatus.CANCELLED) {
        this.logger.warn(
          `Оплата пришла после автоотмены заказа ${orderNumber} — воскрешаю и пере-списываю товар`,
        );
        try {
          await this.prisma.$transaction(async (tx) => {
            for (const item of previous.items) {
              if (item.productId == null) continue;
              await this.decreaseStock(tx, item.productId, item.size ?? '', item.quantity);
            }
          });
        } catch (error: any) {
          this.logger.error(
            `Не удалось пере-списать товар для воскрешённого ${orderNumber}: ${error.message}. ТРЕБУЕТСЯ РУЧНАЯ ПРОВЕРКА`,
          );
        }
      }

      this.logger.log(`Статус заказа обновлен: ${orderNumber}, оплачен`);

      if (previous?.userId) {
        try {
          await this.cartService.clearCart(previous.userId);
        } catch (error: any) {
          this.logger.error(`Не удалось очистить корзину: ${error.message}`);
        }
      }
      try {
        await this.sendPaidOrderReceipt(orderNumber);
      } catch (error: any) {
        this.logger.error(`Не удалось отправить чек (${orderNumber}): ${error.message}`);
      }
      try {
        await this.createCdekInvoiceForOrder(orderNumber);
      } catch (error: any) {
        this.logger.error(`Не удалось создать накладную CDEK (${orderNumber}): ${error.message}`);
      }

      return this.prisma.order.findUnique({ where: { orderNumber } });
    }

    // Неуспешные/промежуточные статусы (FAILED/CANCELED/PENDING/REFUNDED) — обычный апдейт.
    const order = await this.prisma.order.update({
      where: { orderNumber },
      data: {
        status: orderStatus,
        isPaid: false,
        ...(cancelReason !== undefined
          ? { cancelReason }
          : paymentStatus === 'PENDING'
            ? { cancelReason: null }
            : {}),
      },
    });

    this.logger.log(
      `Статус заказа обновлен: ${orderNumber}, status=${orderStatus}, isPaid=false`,
    );

    return order;
  }

  /**
   * Подтвердить оплату Точки, ПЕРЕСПРОСИВ статус через API (не доверяя телу webhook).
   * Webhook лишь триггер — реальный статус берём у Точки по operationId (order.paymentId).
   * Так поддельный webhook не сможет пометить заказ оплаченным.
   */
  async confirmTochkaByApi(orderNumber: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { paymentId: true, isPaid: true },
    });
    if (!order) {
      this.logger.warn(`Tochka confirm: заказ ${orderNumber} не найден`);
      return;
    }
    if (order.isPaid) return; // уже оплачен — идемпотентность
    if (!order.paymentId) {
      this.logger.warn(
        `Tochka confirm: у ${orderNumber} нет operationId — пропуск (не доверяем телу webhook)`,
      );
      return;
    }
    const { rawStatus, mappedStatus } =
      await this.tochkaPayService.getOperationStatus(order.paymentId);
    if (mappedStatus !== 'PENDING') {
      await this.updatePaymentStatus(orderNumber, mappedStatus, rawStatus);
      this.logger.log(
        `Tochka confirm (API): ${orderNumber} → ${mappedStatus} (${rawStatus})`,
      );
    }
  }

  /**
   * Подтвердить оплату Яндекса, ПЕРЕСПРОСИВ статус через API (не доверяя телу webhook).
   * getOrderStatus принимает наш orderNumber.
   */
  async confirmYandexByApi(orderNumber: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      select: { isPaid: true },
    });
    if (!order) {
      this.logger.warn(`Yandex confirm: заказ ${orderNumber} не найден`);
      return;
    }
    if (order.isPaid) return; // уже оплачен — идемпотентность
    const { rawStatus, mappedStatus } =
      await this.yandexPayService.getOrderStatus(orderNumber);
    if (mappedStatus !== 'PENDING') {
      await this.updatePaymentStatus(orderNumber, mappedStatus, rawStatus ?? undefined);
      this.logger.log(
        `Yandex confirm (API): ${orderNumber} → ${mappedStatus} (${rawStatus})`,
      );
    }
  }

  /**
   * Создать накладную CDEK для оплаченного заказа (если доставка CDEK и накладной ещё нет).
   * Сохраняет cdekUuid (и cdekNumber, если CDEK вернул сразу). Трек-номер и статусы
   * дальше приходят через webhook CDEK. Идемпотентно: если cdekUuid уже есть — пропускаем.
   */
  private async createCdekInvoiceForOrder(orderNumber: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) return;

    // Только CDEK-доставка и только если накладная ещё не создана
    if (order.deliveryType !== 'CDEK_PICKUP' || order.cdekUuid) {
      return;
    }
    if (!order.cdekCityCode) {
      this.logger.warn(
        `CDEK накладная не создана для ${orderNumber}: нет cdekCityCode`,
      );
      return;
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
        name: item.name,
        sku: item.productId != null ? String(item.productId) : item.name,
        quantity: item.quantity,
        price: item.price,
        weight: 200,
      })),
    });

    await this.prisma.order.update({
      where: { orderNumber },
      data: {
        cdekUuid: result.uuid,
        // cdekTrackingUrl не храним — он вычисляется из cdekNumber при отдаче заказа.
        ...(result.cdekNumber ? { cdekNumber: result.cdekNumber } : {}),
      },
    });

    this.logger.log(
      `Накладная CDEK создана для ${orderNumber}: uuid=${result.uuid}, cdekNumber=${result.cdekNumber ?? '(придёт по webhook)'}`,
    );
  }

  /**
   * Автоотмена неоплаченных онлайн-заказов по таймауту.
   * Сток списывается при создании заказа, поэтому неоплаченный PENDING держит товар.
   * Раз в минуту находим онлайн-заказы в PENDING старше таймаута, отменяем их
   * и возвращаем товар на склад. Таймаут — ORDER_PENDING_TIMEOUT_MIN (по умолчанию 15 мин).
   */
  /**
   * Через сколько минут неоплаченный заказ автоматически отменяется и товар
   * возвращается на склад (ORDER_PENDING_TIMEOUT_MIN, по умолчанию 25 мин).
   * ВАЖНО: должно быть БОЛЬШЕ ttl платёжной ссылки — чтобы платёж, начатый в
   * последнюю минуту жизни ссылки, успел обработаться (Сплит/банк могут думать
   * дольше минуты) до того, как сработает автоотмена.
   */
  private getPendingTimeoutMin(): number {
    const v = parseInt(process.env.ORDER_PENDING_TIMEOUT_MIN || '25', 10);
    return Number.isFinite(v) && v > 0 ? v : 25;
  }

  /**
   * Срок жизни платёжной ссылки в минутах (ORDER_PAYMENT_LINK_TTL_MIN, по умолчанию
   * 15). После него начать НОВЫЙ платёж нельзя. Меньше таймаута автоотмены —
   * запас между протуханием ссылки и отменой заказа уходит на обработку платежа.
   */
  private getPaymentLinkTtlMin(): number {
    const v = parseInt(process.env.ORDER_PAYMENT_LINK_TTL_MIN || '15', 10);
    return Number.isFinite(v) && v > 0 ? v : 15;
  }

  /**
   * Polling-фолбэк для оплат Точки, пока не настроен webhook.
   * Раз в минуту опрашиваем статус неоплаченных заказов Точки через getOperationStatus
   * (право на чтение платежей у токена есть). При оплате подтверждаем заказ —
   * как это сделал бы webhook. Запускается до автоотмены, чтобы успеть поймать оплату.
   * Отключается переменной TOCHKA_POLLING_ENABLED=false (когда заработает webhook).
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'poll-tochka-payments' })
  async pollTochkaPayments(): Promise<void> {
    if (process.env.TOCHKA_POLLING_ENABLED === 'false') {
      return;
    }
    // Берём только заказы Точки в PENDING с известным operationId (paymentId).
    const timeoutMin = this.getPendingTimeoutMin();
    const cutoff = new Date(Date.now() - timeoutMin * 60 * 1000);

    const pending = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        isPaid: false,
        paymentMethod: PaymentMethod.SBP_TOCHKA,
        paymentId: { not: null },
        createdAt: { gte: cutoff }, // ещё не протухшие — протухшие отменит cancelExpiredOrders
      },
      select: { orderNumber: true, paymentId: true },
    });

    for (const order of pending) {
      if (!order.paymentId) continue;
      try {
        const { mappedStatus } = await this.tochkaPayService.getOperationStatus(
          order.paymentId,
        );
        if (mappedStatus !== 'PENDING') {
          await this.updatePaymentStatus(order.orderNumber, mappedStatus);
          this.logger.log(
            `Tochka polling: заказ ${order.orderNumber} → ${mappedStatus}`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Tochka polling: ошибка статуса ${order.orderNumber}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Polling-фолбэк для оплат Яндекс Пэй/Сплит (на случай если webhook не дошёл).
   * Раз в минуту опрашиваем статус неоплаченных заказов Яндекса через getOrderStatus
   * (принимает наш orderNumber). При оплате (CAPTURED→PAID) подтверждаем заказ.
   * Отключается переменной YANDEX_POLLING_ENABLED=false.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'poll-yandex-payments' })
  async pollYandexPayments(): Promise<void> {
    if (process.env.YANDEX_POLLING_ENABLED === 'false') {
      return;
    }
    const timeoutMin = this.getPendingTimeoutMin();
    const cutoff = new Date(Date.now() - timeoutMin * 60 * 1000);

    const pending = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        isPaid: false,
        paymentMethod: PaymentMethod.YANDEX_PAY,
        createdAt: { gte: cutoff }, // протухшие отменит cancelExpiredOrders
      },
      select: { orderNumber: true },
    });

    for (const order of pending) {
      try {
        const { mappedStatus } = await this.yandexPayService.getOrderStatus(
          order.orderNumber,
        );
        if (mappedStatus !== 'PENDING') {
          await this.updatePaymentStatus(order.orderNumber, mappedStatus);
          this.logger.log(
            `Yandex polling: заказ ${order.orderNumber} → ${mappedStatus}`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Yandex polling: ошибка статуса ${order.orderNumber}: ${error.message}`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'cancel-expired-orders' })
  async cancelExpiredOrders(): Promise<void> {
    const timeoutMin = this.getPendingTimeoutMin();
    const cutoff = new Date(Date.now() - timeoutMin * 60 * 1000);

    const expired = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        isPaid: false,
        createdAt: { lt: cutoff },
        paymentMethod: {
          in: [
            PaymentMethod.YANDEX_PAY,
            PaymentMethod.SBP_TOCHKA,
            PaymentMethod.CARD_ONLINE,
          ],
        },
      },
      include: { items: true },
    });

    if (expired.length === 0) {
      return;
    }

    for (const order of expired) {
      try {
        const cancelled = await this.prisma.$transaction(async (tx) => {
          // Атомарно отменяем ТОЛЬКО если заказ всё ещё PENDING и не оплачен.
          // Закрывает гонку: между выборкой и этим моментом могла прийти оплата —
          // тогда updateMany затронет 0 строк, и сток мы НЕ возвращаем.
          const res = await tx.order.updateMany({
            where: { id: order.id, status: OrderStatus.PENDING, isPaid: false },
            data: {
              status: OrderStatus.CANCELLED,
              cancelReason: `Не оплачен в течение ${timeoutMin} мин — автоотмена`,
            },
          });
          if (res.count === 0) {
            return false; // заказ уже изменился (оплачен) — не трогаем сток
          }
          // Возвращаем товар на склад и откатываем счётчик продаж
          for (const item of order.items) {
            if (item.productId == null) continue;
            await this.restoreStock(
              tx,
              item.productId,
              item.size ?? '',
              item.quantity,
            );
          }
          return true;
        });
        if (!cancelled) {
          this.logger.log(
            `Заказ ${order.orderNumber} НЕ отменён — оплата пришла во время обработки`,
          );
          continue;
        }
        this.logger.log(
          `Заказ ${order.orderNumber} отменён по таймауту (${timeoutMin} мин), товар возвращён на склад`,
        );
      } catch (error: any) {
        this.logger.error(
          `Не удалось отменить заказ ${order.orderNumber} по таймауту: ${error.message}`,
        );
      }
    }
  }

  /**
   * Вернуть товар на склад (обратная операция к decreaseStock):
   * увеличивает остаток по размеру и откатывает salesCount.
   */
  private async restoreStock(
    tx: any,
    productId: number,
    size: string,
    quantity: number,
  ): Promise<void> {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      this.logger.warn(`restoreStock: товар ${productId} не найден`);
      return;
    }

    const stock = (product.stock as any) || {};
    const currentStock = stock[size] || 0;
    const newStock = { ...stock };
    newStock[size] = currentStock + quantity;

    await tx.product.update({
      where: { id: productId },
      data: {
        stock: newStock,
        salesCount: { decrement: quantity },
      },
    });

    this.logger.log(
      `Сток возвращён: товар ${productId}, размер ${size}: ${currentStock} -> ${newStock[size]}`,
    );
  }

  /**
   * Отправить email-чек об УСПЕШНОЙ оплате заказа.
   * Вызывается из updatePaymentStatus при первом переходе заказа в isPaid=true
   * (по webhook от платёжки). Для онлайн-оплат это единственное место отправки чека —
   * чтобы клиент не получал «успешный» чек до фактической оплаты.
   */
  private async sendPaidOrderReceipt(orderNumber: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) {
      this.logger.warn(`Чек не отправлен: заказ ${orderNumber} не найден`);
      return;
    }

    const subtotal = order.subtotal;
    const discountAmount = order.discountAmount;
    // originalSubtotal = сумма товаров до скидки (subtotal уже без доставки)
    const originalSubtotal = subtotal + discountAmount;

    await this.emailService.sendOrderConfirmation(order.email, {
      orderNumber: order.orderNumber,
      firstName: order.firstName,
      lastName: order.lastName,
      items: order.items.map((item) => ({
        name: item.name,
        size: item.size ?? '',
        quantity: item.quantity,
        price: item.price,
      })),
      originalSubtotal,
      subtotal,
      discountAmount,
      promoCode: null,
      deliveryPrice: order.deliveryTotal,
      total: order.total,
      paymentMethod: order.paymentMethod,
    });

    this.logger.log(`Email-чек об оплате отправлен: ${order.email} (${orderNumber})`);
  }
}
