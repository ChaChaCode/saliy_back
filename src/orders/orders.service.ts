import {
  purchaseAvailability,
  waitingForPreorder,
  lockProducts,
  changeReservedQuantity,
} from '../common/utils/preorder.util';
import { TbankPayService } from '../payment/tbank-pay.service';
import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, PaymentMethod, DeliveryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './orders.dto';
import { EmailService } from '../common/email/email.service';
import { PromoService } from '../promo/promo.service';
import { CartService } from '../cart/cart.service';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';
import { pickMainImage } from '../common/utils/product-image.util';
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
    private readonly tbankPayService: TbankPayService,
    private readonly deliveryService: DeliveryService,
  ) {}

  /**
   * Создать заказ (для гостей и авторизованных)
   * ВАЖНО: Валидация товаров и цен на сервере!
   */
  async createOrder(dto: CreateOrderDto, userId?: string) {
    if (dto.paymentMethod !== PaymentMethod.CARD_ONLINE)
      throw new BadRequestException('Доступна только оплата через Т-Банк');
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
    let isFreeDelivery = false;
    if (promoCode) {
      const promoResult = await this.applyPromoCode(
        promoCode,
        subtotal,
        validatedItems,
        userId,
      );
      discountAmount = promoResult.discountAmount;
      promoCodeId = promoResult.promoCodeId;
      isFreeDelivery = promoResult.isFreeDelivery;
    }

    // 🔒 ШАГ 4: РАСЧЕТ ДОСТАВКИ (промокод FREE_DELIVERY обнуляет её)
    const deliveryPrice = isFreeDelivery
      ? 0
      : await this.calculateDeliveryPrice(
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
          orderInfo.regionName =
            orderInfo.regionName || pvz.region || undefined;
          orderInfo.postalCode =
            orderInfo.postalCode || pvz.postalCode || undefined;
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

    const isOnlinePayment = true;

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
              isPreorder: item.isPreorder,
              preorderReady: item.preorderReady ?? false,
            })),
          },
        } as any,
        include: {
          items: true,
        },
      });

      // 🔒 ШАГ 7: УМЕНЬШЕНИЕ ОСТАТКОВ НА СКЛАДЕ
      await this.reserveOrderItems(tx, validatedItems);

      return newOrder;
    });

    this.logger.log(
      `Заказ создан: ${order.orderNumber}, товаров: ${items.length}, сумма: ${total} RUB`,
    );

    // 🔒 ШАГ 8: ЗАПИСЬ ИСПОЛЬЗОВАНИЯ ПРОМОКОДА
    if (promoCodeId) {
      await this.promoService.usePromoCode(promoCodeId, userId, order.id);
      this.logger.log(
        `Промокод записан в историю использования для заказа ${order.orderNumber}`,
      );
    }

    // 🔒 ШАГ 8.5: РЕГИСТРАЦИЯ ПЛАТЕЖА (если оплата онлайн)
    let paymentUrl: string | null = null;
    if (isOnlinePayment) {
      const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
      const successUrl = `${frontendBase}/order/${order.orderNumber}?payment=success`;
      const failUrl = `${frontendBase}/order/${order.orderNumber}?payment=fail`;

      try {
        const payment = await this.tbankPayService.registerOrder({
          orderNumber: order.orderNumber,
          amount: total,
          successUrl,
          failUrl,
          ttlMinutes: this.getPaymentLinkTtlMin(),
        });
        paymentUrl = payment.paymentUrl;
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentId: payment.paymentId },
        });
      } catch (error: any) {
        this.logger.error(
          `Регистрация платежа (${dto.paymentMethod}) не удалась для ${order.orderNumber}: ${error.message}`,
        );
        await this.releaseUnpaidOrder(
          order.orderNumber,
          OrderStatus.PAYMENT_FAILED,
          `Ошибка регистрации платежа (${dto.paymentMethod}): ${error.message}`.slice(
            0,
            500,
          ),
        );
        throw new BadRequestException(
          'Не удалось инициализировать платёж. Попробуйте позже.',
        );
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
        isPreorder: item.isPreorder,
        preorderReady: item.preorderReady ?? false,
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
    let isFreeDelivery = false;
    if (promoCode) {
      const promoResult = await this.applyPromoCode(
        promoCode,
        subtotal,
        validatedItems,
        undefined, // userId не передается в calculateOrder
      );
      discountAmount = promoResult.discountAmount;
      isFreeDelivery = promoResult.isFreeDelivery;
    }

    // 🔒 ШАГ 4: РАСЧЕТ ДОСТАВКИ (промокод FREE_DELIVERY обнуляет её)
    const deliveryPrice = isFreeDelivery
      ? 0
      : await this.calculateDeliveryPrice(
          deliveryType,
          cdekCityCode,
          validatedItems,
        );

    // 🔒 ШАГ 5: ИТОГОВАЯ СУММА
    const total = subtotal - discountAmount + deliveryPrice;

    return {
      items: validatedItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount,
        isPreorder: item.isPreorder,
        preorderReady: item.preorderReady ?? false,
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
   * Создать заказ ВРУЧНУЮ из админки (менеджером). Клиент написал в личку/инсту —
   * менеджер заносит заказ. Без онлайн-платёжки: способ оплаты задаётся вручную
   * (обычно BANK_TRANSFER/CARD_MANUAL), оплату можно сразу пометить или ждать.
   * Цены и сток — из БД. Если paid=true — подтверждаем через updatePaymentStatus
   * (чек, накладная CDEK). Если нет — заказ PENDING (НЕ онлайн → автоотмена не трогает).
   */
  async createManualOrder(dto: {
    items: { productId: number; size: string; quantity: number }[];
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    socialContact?: string;
    comment?: string;
    deliveryType: DeliveryType;
    paymentMethod: PaymentMethod;
    paid?: boolean;
    countryName?: string;
    regionName?: string;
    cityName?: string;
    cdekCityCode?: number;
    street?: string;
    apartment?: string;
    postalCode?: string;
    pickupPoint?: string;
    deliveryPrice?: number;
  }) {
    const validatedItems = await this.validateOrderItems(dto.items);
    const subtotal = validatedItems.reduce((s, i) => s + i.totalPrice, 0);
    const deliveryPrice = dto.deliveryPrice ?? 0;
    const total = subtotal + deliveryPrice;

    // Для CDEK_PICKUP подтянем адрес ПВЗ, как в обычном createOrder
    let cityName = dto.cityName;
    let regionName = dto.regionName;
    let postalCode = dto.postalCode;
    let street = dto.street;
    if (dto.deliveryType === 'CDEK_PICKUP' && dto.pickupPoint) {
      try {
        const pvz = await this.deliveryService.getCdekPickupPointByCode(
          dto.pickupPoint,
        );
        if (pvz) {
          cityName = cityName || pvz.city || undefined;
          regionName = regionName || pvz.region || undefined;
          postalCode = postalCode || pvz.postalCode || undefined;
          street = street || pvz.addressFull || undefined;
        }
      } catch (e: any) {
        this.logger.error(
          `Ручной заказ: не подтянул ПВЗ ${dto.pickupPoint}: ${e.message}`,
        );
      }
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber();
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          email: dto.email,
          socialContact: dto.socialContact,
          comment: dto.comment,
          countryName: dto.countryName,
          regionName,
          cityName,
          cdekCityCode: dto.cdekCityCode,
          street,
          apartment: dto.apartment,
          postalCode,
          pickupPoint: dto.pickupPoint,
          deliveryType: dto.deliveryType,
          paymentMethod: dto.paymentMethod,
          deliveryPrice,
          deliveryTotal: deliveryPrice,
          subtotal,
          discountAmount: 0,
          total,
          currency: 'RUB',
          status: OrderStatus.PENDING,
          isPaid: false,
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              name: item.productName,
              size: item.size,
              color: item.color,
              quantity: item.quantity,
              price: item.price,
              discount: item.discount,
              isPreorder: item.isPreorder,
              preorderReady: item.preorderReady ?? false,
            })),
          },
        } as any,
        include: { items: true },
      });

      await this.reserveOrderItems(tx, validatedItems);
      return newOrder;
    });

    this.logger.log(
      `Ручной заказ создан: ${order.orderNumber}, сумма ${total} RUB`,
    );

    // Если менеджер сразу отметил оплату — подтверждаем (чек, накладная CDEK).
    if (dto.paid) {
      await this.updatePaymentStatus(order.orderNumber, 'PAID', 'manual');
    }

    return this.prisma.order.findUnique({
      where: { orderNumber: order.orderNumber },
      include: { items: true },
    });
  }

  /**
   * 🔒 ВАЛИДАЦИЯ ТОВАРОВ ПЕРЕД ЗАКАЗОМ
   * Проверяет наличие, активность и остатки на складе
   */
  private async validateOrderItems(
    items: { productId: number; size: string; quantity: number }[],
  ) {
    const grouped = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      const key = JSON.stringify([item.productId, item.size]);
      const existing = grouped.get(key);
      if (existing) existing.quantity += item.quantity;
      else grouped.set(key, { ...item });
    }
    items = [...grouped.values()];
    const validatedItems: any[] = [];

    for (const item of items) {
      // Получаем товар из БД
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, deletedAt: null },
      });

      if (!product) {
        throw new BadRequestException(`Товар с ID ${item.productId} не найден`);
      }

      if (!product.isActive) {
        throw new BadRequestException(
          `Товар "${product.name}" недоступен для заказа`,
        );
      }

      // 🔒 ПРОВЕРКА ОСТАТКОВ НА СКЛАДЕ
      const availability = purchaseAvailability(product, item.size);
      const { availableQuantity } = availability;

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
        ...availability,
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
  private async reserveOrderItems(tx: any, items: any[]) {
    await lockProducts(
      tx,
      items.map((item) => item.productId),
    );
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      const current = product && purchaseAvailability(product, item.size);
      if (
        !product ||
        !product.isActive ||
        product.deletedAt ||
        current.isPreorder !== item.isPreorder ||
        product.price !== item.price ||
        product.discount !== item.discount
      ) {
        throw new BadRequestException(
          'Условия товара изменились. Пересчитайте заказ',
        );
      }
      await changeReservedQuantity(tx, item);
    }
  }

  /**
   * Применить промокод
   */
  private async applyPromoCode(
    code: string,
    subtotal: number,
    validatedItems: any[],
    userId?: string,
  ): Promise<{
    discountAmount: number;
    promoCodeId?: number;
    isFreeDelivery: boolean;
  }> {
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
      throw new BadRequestException(
        result.message || 'Промокод недействителен',
      );
    }

    this.logger.log(`Промокод ${code} применен: скидка ${result.discount} ₽`);

    return {
      discountAmount: result.discount,
      promoCodeId: result.promoCode?.id,
      isFreeDelivery: result.isFreeDelivery === true,
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
  async getOrderByNumber(
    orderNumber: string,
    requesterUserId?: string,
    requesterEmail?: string,
  ) {
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
        isPreorder: item.isPreorder,
        preorderReady: item.preorderReady ?? false,
        finalPrice,
        totalPrice: finalPrice * item.quantity,
        imageUrl,
      };
    });

    const originalSubtotal = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Владелец заказа: авторизованный пользователь, чей userId или email
    // совпадает с заказом. Только ему отдаём персональные данные — иначе
    // перебором предсказуемых номеров заказа сливались бы ПДн всех клиентов.
    const isOwner =
      (!!requesterUserId && order.userId === requesterUserId) ||
      (!!requesterEmail &&
        !!order.email &&
        order.email.toLowerCase() === requesterEmail.toLowerCase());

    const base = {
      ...order,
      items: formattedItems,
      originalSubtotal,
      promoCode:
        order.promoCodeUsages.length > 0
          ? order.promoCodeUsages[0].promoCode
          : null,
    };

    if (isOwner) {
      return base;
    }

    // Не владелец: возвращаем заказ БЕЗ персональных данных. Статус, суммы и
    // состав нужны для страницы «спасибо за заказ», ПДн — нет.
    return {
      ...base,
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
      socialContact: null,
      street: null,
      apartment: null,
      postalCode: null,
      cityName: null,
      regionName: null,
      countryName: null,
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
      where: email ? { OR: [{ userId }, { email }] } : { userId },
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
          isPreorder: item.isPreorder,
          preorderReady: item.preorderReady ?? false,
          finalPrice,
          totalPrice: finalPrice * item.quantity,
          imageUrl,
        };
      });

      const originalSubtotal = formattedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return {
        ...order,
        items: formattedItems,
        originalSubtotal,
        promoCode:
          order.promoCodeUsages.length > 0
            ? order.promoCodeUsages[0].promoCode
            : null,
      };
    });
  }

  /**
   * Обновить статус оплаты заказа.
   * На вход — внутренний статус платежа (из TbankPayService.getState):
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
      select: {
        isPaid: true,
        userId: true,
        status: true,
        items: true,
        inventoryReleased: true,
      },
    });

    // ПЕРЕХОД В ОПЛАЧЕНО — атомарно, чтобы исключить TOCTOU-гонку webhook vs polling.
    // updateMany ... WHERE isPaid=false: побочки (чек/корзина/накладная) выполняет
    // ТОЛЬКО тот вызов, который реально перевёл заказ (count===1). Параллельный
    // второй вызов получит count===0 и побочки не продублирует.
    if (isPaid) {
      const transition = await this.prisma
        .$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM orders WHERE order_number = ${orderNumber} FOR UPDATE`;
          const current = await tx.order.findUnique({
            where: { orderNumber },
            include: { items: true },
          });
          if (!current || current.isPaid) return { count: 0 };
          if (current.status === OrderStatus.REFUNDED) return { count: 0 };
          if (current.inventoryReleased) {
            await lockProducts(
              tx,
              current.items.flatMap((item) =>
                item.productId == null ? [] : [item.productId],
              ),
            );
            for (const item of current.items) {
              if (item.productId == null) continue;
              await changeReservedQuantity(tx, {
                ...item,
                productId: item.productId,
                size: item.size ?? '',
              });
            }
          }
          return tx.order.updateMany({
            where: { orderNumber, isPaid: false },
            data: {
              status: waitingForPreorder(current)
                ? OrderStatus.AWAITING_PREORDER
                : OrderStatus.CONFIRMED,
              isPaid: true,
              cancelReason: null,
              inventoryReleased: false,
            },
          });
        })
        .catch(async (error) => {
          if (!(error instanceof BadRequestException)) throw error;
          // A late payment is real even if the released slot has already been sold.
          // Keep it paid for manual resolution, without creating a shipment.
          return this.prisma.order.updateMany({
            where: {
              orderNumber,
              isPaid: false,
              inventoryReleased: true,
              status: { not: OrderStatus.REFUNDED },
            },
            data: {
              isPaid: true,
              status: OrderStatus.PROCESSING,
              cancelReason:
                'Оплата после отмены: не удалось восстановить резерв. Требуется проверка менеджера',
            },
          });
        });
      if (transition.count === 0)
        return this.prisma.order.findUnique({ where: { orderNumber } });

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
        this.logger.error(
          `Не удалось отправить чек (${orderNumber}): ${error.message}`,
        );
      }
      try {
        await this.createCdekInvoiceForOrder(orderNumber);
      } catch (error: any) {
        this.logger.error(
          `Не удалось создать накладную CDEK (${orderNumber}): ${error.message}`,
        );
      }

      return this.prisma.order.findUnique({ where: { orderNumber } });
    }

    // Отказ или отмена неоплаченного заказа: покупатель оформит новый заказ
    // («Оплатить снова» ведёт в checkout), поэтому бронь товара снимаем сразу.
    if (
      (paymentStatus === 'FAILED' || paymentStatus === 'CANCELED') &&
      cancelReason !== undefined
    ) {
      const released = await this.releaseUnpaidOrder(
        orderNumber,
        orderStatus,
        cancelReason,
      );
      this.logger.log(
        released
          ? `Статус заказа обновлен: ${orderNumber}, status=${orderStatus}, товар возвращён на склад`
          : `Заказ ${orderNumber} уже не в ожидании оплаты — статус ${paymentStatus} пропущен`,
      );
      return this.prisma.order.findUnique({ where: { orderNumber } });
    }

    if (paymentStatus === 'REFUNDED')
      return this.recordRefund(orderNumber, cancelReason);
    // Intermediate notifications never change an existing payment state.
    return this.prisma.order.findUnique({ where: { orderNumber } });
  }

  // Records a completed/manual refund. Bank refunds are performed in the bank account.
  async recordRefund(orderNumber: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE order_number = ${orderNumber} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { orderNumber },
        include: { items: true },
      });
      if (!order) throw new BadRequestException('Заказ не найден');
      if (order.status === OrderStatus.REFUNDED) return order;
      // Only unfulfilled preorders are released automatically on refund.
      const release = !order.inventoryReleased && waitingForPreorder(order);
      if (release) {
        await lockProducts(
          tx,
          order.items.flatMap((item) =>
            item.productId == null ? [] : [item.productId],
          ),
        );
        for (const item of order.items) {
          if (item.productId == null) continue;
          await changeReservedQuantity(
            tx,
            { ...item, productId: item.productId, size: item.size ?? '' },
            true,
          );
        }
      }
      return tx.order.update({
        where: { orderNumber },
        data: {
          status: OrderStatus.REFUNDED,
          isPaid: false,
          inventoryReleased: order.inventoryReleased || release,
          cancelReason: reason ?? 'Оформлен возврат средств',
        },
      });
    });
  }

  async confirmTbankByApi(
    orderNumber: string,
    paymentId?: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
    });
    if (
      !order ||
      order.paymentMethod !== PaymentMethod.CARD_ONLINE ||
      !order.paymentId ||
      (paymentId !== undefined && order.paymentId !== paymentId)
    )
      throw new BadRequestException('Платёж не найден');
    const state = await this.tbankPayService.getState(order.paymentId);
    if (
      String(state.PaymentId) !== order.paymentId ||
      state.OrderId !== orderNumber ||
      state.Amount !== Math.round(order.total * 100)
    )
      throw new BadRequestException('Реквизиты платежа не совпадают');
    const mappedStatus = this.tbankPayService.mapStatus(state.Status);
    if (
      mappedStatus !== 'PENDING' &&
      (!order.isPaid || mappedStatus === 'REFUNDED')
    )
      await this.updatePaymentStatus(orderNumber, mappedStatus, state.Status);
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
    if (
      !order.isPaid ||
      order.inventoryReleased ||
      waitingForPreorder(order) ||
      [
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
        OrderStatus.PAYMENT_FAILED,
      ].includes(order.status as any) ||
      order.deliveryType !== 'CDEK_PICKUP' ||
      order.cdekUuid
    ) {
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
        // Размер в названии — чтобы отправитель видел в накладной CDEK, что класть
        // (у CDEK нет отдельного поля размера).
        name: item.size ? `${item.name} (${item.size})` : item.name,
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

  @Cron(CronExpression.EVERY_MINUTE, { name: 'poll-tbank-payments' })
  async pollTbankPayments(): Promise<void> {
    if (process.env.TBANK_POLLING_ENABLED === 'false') return;
    const pending = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        isPaid: false,
        paymentMethod: PaymentMethod.CARD_ONLINE,
        paymentId: { not: null },
      },
      select: { orderNumber: true },
    });
    for (const order of pending) {
      try {
        await this.confirmTbankByApi(order.orderNumber);
      } catch {
        this.logger.warn(
          'Не удалось проверить платёж Т-Банка: ' + order.orderNumber,
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
      select: { orderNumber: true },
    });

    if (expired.length === 0) {
      return;
    }

    for (const order of expired) {
      try {
        const cancelled = await this.releaseUnpaidOrder(
          order.orderNumber,
          OrderStatus.CANCELLED,
          `Не оплачен в течение ${timeoutMin} мин — автоотмена`,
        );
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
   * Перевести неоплаченный PENDING-заказ в неуспешный статус и вернуть товар на склад.
   * Атомарно: если заказ уже не PENDING (оплачен, отменён, уже отклонён) — ничего
   * не меняет и возвращает false, так что сток не возвращается дважды.
   */
  private async releaseUnpaidOrder(
    orderNumber: string,
    status: OrderStatus,
    cancelReason: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: {
          orderNumber,
          status: OrderStatus.PENDING,
          isPaid: false,
          inventoryReleased: false,
        },
        data: { status, cancelReason, inventoryReleased: true },
      });
      if (res.count === 0) return false;
      const items = await tx.orderItem.findMany({
        where: { order: { orderNumber } },
      });
      await lockProducts(
        tx,
        items.flatMap((item) =>
          item.productId == null ? [] : [item.productId],
        ),
      );
      for (const item of items) {
        if (item.productId == null) continue;
        await changeReservedQuantity(
          tx,
          { ...item, productId: item.productId, size: item.size ?? '' },
          true,
        );
      }
      return true;
    });
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
        isPreorder: item.isPreorder,
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

    this.logger.log(
      `Email-чек об оплате отправлен: ${order.email} (${orderNumber})`,
    );
  }
}
