import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface YandexPayCartItem {
  productId: string;
  title: string;
  quantity: number; // целое или дробное (например 1.5 кг)
  unitPrice: number; // цена за единицу в рублях
}

export interface YandexPayRegisterParams {
  orderId: string; // наш orderNumber
  amount: number; // итоговая сумма в рублях (то, что должен заплатить клиент)
  description?: string;
  redirectUrl: string; // куда редирект после успешной оплаты
  cancelUrl?: string; // если оплата отменена
  cartItems: YandexPayCartItem[]; // включая «доставку» как отдельную строку
  discount?: { code: string; amount: number }; // промокод, если применён
}

export interface YandexPayRegisterResult {
  orderId: string; // наш orderId, как мы его передали
  paymentUrl: string; // куда редиректить клиента
  yandexOrderId?: string; // внутренний id заказа на стороне Яндекса
}

/**
 * Маппинг статусов Яндекс Пэй → внутренний статус.
 * Возможные orderStatus: NEW / AUTHORIZED / CAPTURED / VOIDED / REFUNDED / PARTIALLY_REFUNDED / FAILED
 * https://pay.yandex.ru/docs/ru/custom/backend/yandex-pay-api/order/merchant_v1_order-get
 */
const YANDEX_STATUS_MAP: Record<string, 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED'> = {
  NEW: 'PENDING',
  AUTHORIZED: 'PENDING',
  CAPTURED: 'PAID',
  VOIDED: 'CANCELED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'REFUNDED',
  FAILED: 'FAILED',
};

@Injectable()
export class YandexPayService {
  private readonly logger = new Logger(YandexPayService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly merchantId: string;
  private readonly isSandbox: boolean;
  /** Разрешённые способы оплаты внутри Яндекс Пэй. По умолчанию только SPLIT. */
  private readonly availableMethods: string[];

  constructor() {
    this.isSandbox = process.env.YANDEX_PAY_SANDBOX !== 'false';
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.pay.yandex.ru/api/merchant'
      : 'https://pay.yandex.ru/api/merchant';
    this.apiKey = process.env.YANDEX_PAY_API_KEY || '';
    this.merchantId = process.env.YANDEX_PAY_MERCHANT_ID || '';
    // YANDEX_PAY_METHODS — список через запятую (например "SPLIT" или "SPLIT,CARD").
    // Пусто/не задано → только SPLIT (нам нужна оплата частями).
    this.availableMethods = (process.env.YANDEX_PAY_METHODS || 'SPLIT')
      .split(',')
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean);

    if (!this.apiKey || !this.merchantId) {
      this.logger.warn(
        'YANDEX_PAY_API_KEY/YANDEX_PAY_MERCHANT_ID не заданы — Яндекс Пэй работать не будет',
      );
    }
  }

  /**
   * Создать платёжную ссылку.
   * POST {base}/v1/orders
   */
  async registerOrder(
    params: YandexPayRegisterParams,
  ): Promise<YandexPayRegisterResult> {
    const url = `${this.baseUrl}/v1/orders`;

    // Яндекс ждёт суммы строкой с двумя знаками после запятой ("15480.00")
    const formatAmount = (n: number) => n.toFixed(2);

    const cart: any = {
      items: params.cartItems.map((item, i) => ({
        productId: item.productId || `${params.orderId}-${i}`,
        title: item.title.slice(0, 256),
        quantity: { count: item.quantity.toFixed(2) },
        total: formatAmount(item.unitPrice * item.quantity),
        unitPrice: formatAmount(item.unitPrice),
      })),
      total: { amount: formatAmount(params.amount) },
    };
    if (params.discount && params.discount.amount > 0) {
      cart.coupons = [
        {
          value: params.discount.code,
          description: `Промокод ${params.discount.code}`,
          amount: formatAmount(params.discount.amount),
        },
      ];
    }

    const body = {
      orderId: params.orderId,
      currencyCode: 'RUB', // ISO 4217 буквенный
      cart,
      merchantId: this.merchantId,
      orderAmount: formatAmount(params.amount),
      redirectUrls: {
        onSuccess: params.redirectUrl,
        onError: params.cancelUrl || params.redirectUrl,
        onAbort: params.cancelUrl || params.redirectUrl,
      },
      // Ограничиваем способы оплаты (по умолчанию только SPLIT — оплата частями).
      ...(this.availableMethods.length
        ? { availablePaymentMethods: this.availableMethods }
        : {}),
    };

    this.logger.log(
      `Yandex Pay register: orderId=${params.orderId}, sandbox=${this.isSandbox}, redirectUrls=${JSON.stringify(body.redirectUrls)}`,
    );

    try {
      const { data } = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Api-Key ${this.apiKey}`,
        },
        timeout: 15000,
      });

      // Yandex возвращает { status: 'success', data: { paymentUrl, orderId, ... } }
      if (data?.status !== 'success') {
        this.logger.error(
          `Yandex Pay register error: ${JSON.stringify(data)}`,
        );
        throw new Error(`Yandex Pay register failed: ${data?.reason || 'unknown'}`);
      }

      const paymentUrl: string | undefined = data.data?.paymentUrl;
      const yandexOrderId: string | undefined = data.data?.orderId;

      if (!paymentUrl) {
        throw new Error('Yandex Pay register: paymentUrl отсутствует в ответе');
      }

      this.logger.log(
        `Платёж зарегистрирован в Yandex Pay: orderId=${params.orderId}, yandexOrderId=${yandexOrderId}`,
      );

      return {
        orderId: params.orderId,
        paymentUrl,
        yandexOrderId,
      };
    } catch (error: any) {
      const msg = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`Yandex Pay register error: ${msg}`);
      throw new Error('Yandex Pay registration failed');
    }
  }

  /**
   * Получить статус заказа в Yandex Pay.
   * GET {base}/v1/orders/{orderId}
   * Принимает наш orderId (тот, который мы передали при регистрации).
   */
  async getOrderStatus(orderId: string): Promise<{
    rawStatus: string | null;
    mappedStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED';
    raw: any;
  }> {
    const url = `${this.baseUrl}/v1/orders/${encodeURIComponent(orderId)}`;
    try {
      const { data } = await axios.get(url, {
        headers: { Authorization: `Api-Key ${this.apiKey}` },
        timeout: 15000,
      });

      const orderStatus: string | undefined = data?.data?.order?.status;
      const mapped = orderStatus
        ? YANDEX_STATUS_MAP[orderStatus] ?? 'PENDING'
        : 'PENDING';

      return {
        rawStatus: orderStatus ?? null,
        mappedStatus: mapped,
        raw: data,
      };
    } catch (error: any) {
      const msg = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`Yandex Pay status error: ${msg}`);
      throw new Error('Yandex Pay status request failed');
    }
  }
}
