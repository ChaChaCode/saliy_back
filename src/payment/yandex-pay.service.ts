import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createPublicKey, verify, type JsonWebKey, type KeyObject } from 'crypto';
import type { PaymentStatus } from './tbank-pay.service';
import type { YandexCart } from './yandex-pay.cart';

const ALLOWED_METHODS = ['CARD', 'SPLIT'];
const JWKS_TTL_MS = 60 * 60 * 1000;
// Неизвестный kid заставляет перечитать ключи, но не чаще раза в минуту:
// иначе поддельные уведомления превращаются в поток запросов к Яндексу.
const JWKS_REFETCH_MS = 60 * 1000;
const CLOCK_SKEW_SEC = 300;

export interface YandexWebhookPayload {
  merchantId?: string;
  event?: string;
  order?: { orderId?: string; paymentStatus?: string };
  operation?: { orderId?: string; status?: string; operationType?: string };
}

/**
 * Яндекс Пэй / Сплит, Merchant API:
 * https://pay.yandex.ru/docs/ru/custom/backend/yandex-pay-api/
 */
@Injectable()
export class YandexPayService {
  private readonly logger = new Logger(YandexPayService.name);
  private readonly merchantId = process.env.YANDEX_PAY_MERCHANT_ID || '';
  private readonly apiKey = process.env.YANDEX_PAY_API_KEY || '';
  private readonly host =
    process.env.YANDEX_PAY_SANDBOX === 'true'
      ? 'https://sandbox.pay.yandex.ru'
      : 'https://pay.yandex.ru';
  private readonly methods = (process.env.YANDEX_PAY_METHODS || 'CARD,SPLIT')
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter((m) => ALLOWED_METHODS.includes(m));
  private readonly http = axios.create({ timeout: 15000 });
  private jwks = new Map<string, KeyObject>();
  private jwksFetchedAt = 0;

  isConfigured(): boolean {
    return !!this.merchantId && !!this.apiKey && this.methods.length > 0;
  }

  async registerOrder(params: {
    orderNumber: string;
    cart: YandexCart;
    successUrl: string;
    failUrl: string;
    ttlMinutes: number;
    phone?: string;
  }) {
    const phone = params.phone?.replace(/[\s()-]/g, '');
    const body = {
      orderId: params.orderNumber,
      currencyCode: 'RUB',
      cart: params.cart,
      availablePaymentMethods: this.methods,
      redirectUrls: {
        onSuccess: params.successUrl,
        onError: params.failUrl,
        onAbort: params.failUrl,
      },
      ttl: Math.min(Math.max(params.ttlMinutes * 60, 120), 604800),
      orderSource: 'WEBSITE',
      // Телефон помогает Яндексу одобрить Сплит; неформатный не отправляем.
      ...(phone && /^\+?\d{11,15}$/.test(phone) && { billingPhone: phone }),
    };
    let data: any;
    try {
      ({ data } = await this.http.post(
        `${this.host}/api/merchant/v1/orders`,
        body,
        { headers: { Authorization: `Api-Key ${this.apiKey}` } },
      ));
    } catch (error: any) {
      // Ответ Яндекса без заголовков запроса: в них ключ API.
      this.logger.error(
        `Яндекс Пэй: заказ ${params.orderNumber} не создан: ` +
          JSON.stringify(error.response?.data ?? error.message).slice(0, 500),
      );
      throw new BadGatewayException('Яндекс Пэй временно недоступен');
    }
    const paymentUrl: string | undefined = data?.data?.paymentUrl;
    if (data?.status !== 'success' || !paymentUrl)
      throw new BadGatewayException('Яндекс Пэй не вернул ссылку на оплату');
    return { paymentId: params.orderNumber, paymentUrl };
  }

  async getOrder(orderNumber: string): Promise<{
    paymentStatus: string | null;
    orderAmount: number | null;
    reason: string | null;
    // Сумма успешных возвратов (операции REFUND со статусом SUCCESS), ₽
    refundedAmount: number;
    // Чем платил покупатель: CARD, SPLIT, SBP… (paymentMethod.methodType)
    methodType: string | null;
  }> {
    try {
      const { data } = await this.http.get(
        `${this.host}/api/merchant/v1/orders/${encodeURIComponent(orderNumber)}`,
        { headers: { Authorization: `Api-Key ${this.apiKey}` } },
      );
      const order = data?.data?.order;
      const operations: Array<{
        operationType?: string;
        status?: string;
        amount?: string | number;
      }> = Array.isArray(data?.data?.operations) ? data.data.operations : [];
      const refundedKop = operations
        .filter((op) => op.operationType === 'REFUND' && op.status === 'SUCCESS')
        .reduce((sum, op) => sum + Math.round(Number(op.amount ?? 0) * 100), 0);
      return {
        refundedAmount: refundedKop / 100,
        methodType:
          typeof order?.paymentMethod?.methodType === 'string'
            ? order.paymentMethod.methodType.slice(0, 32)
            : null,
        paymentStatus: order?.paymentStatus ?? null,
        orderAmount: order?.orderAmount != null ? Number(order.orderAmount) : null,
        reason: order?.reasonCode
          ? `${order.reason ? `${order.reason} ` : ''}(${order.reasonCode})`.slice(0, 300)
          : null,
      };
    } catch (error: any) {
      this.logger.error(
        `Яндекс Пэй: статус ${orderNumber} не получен: ` +
          JSON.stringify(error.response?.data ?? error.message).slice(0, 500),
      );
      throw new BadGatewayException('Яндекс Пэй временно недоступен');
    }
  }

  // Платёж по умолчанию одностадийный: деньги получены только в CAPTURED.
  // AUTHORIZED и CONFIRMED бывают у холдирования и Сплита «при получении»,
  // которые мы не включаем, поэтому для нас это ещё ожидание.
  mapStatus(status: string | null): PaymentStatus {
    switch (status) {
      case 'CAPTURED':
        return 'PAID';
      case 'FAILED':
        return 'FAILED';
      case 'VOIDED':
        return 'CANCELED';
      case 'REFUNDED':
        return 'REFUNDED';
      default:
        return 'PENDING';
    }
  }

  /**
   * Уведомление приходит телом-JWT (ES256). Проверяем подпись ключом Яндекса
   * из JWKS, срок токена и merchantId — так требует документация webhook.
   * Возвращает null для любого токена, которому нельзя доверять.
   */
  async verifyWebhookToken(token: string): Promise<YandexWebhookPayload | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signaturePart] = parts;
    let header: { alg?: string; kid?: string };
    let payload: YandexWebhookPayload & { exp?: number; iat?: number };
    try {
      header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (header.alg !== 'ES256' || typeof header.kid !== 'string') return null;

    const key = await this.getJwk(header.kid);
    if (!key) return null;
    const isValid = verify(
      'sha256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signaturePart, 'base64url'),
    );
    if (!isValid) return null;

    const now = Date.now() / 1000;
    if (typeof payload.exp === 'number' && payload.exp + CLOCK_SKEW_SEC < now) return null;
    if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_SEC > now) return null;
    if (!this.merchantId || payload.merchantId !== this.merchantId) return null;
    return payload;
  }

  private async getJwk(kid: string): Promise<KeyObject | null> {
    const age = Date.now() - this.jwksFetchedAt;
    if (age > JWKS_TTL_MS || (!this.jwks.has(kid) && age > JWKS_REFETCH_MS)) {
      try {
        const { data } = await this.http.get<{ keys?: (JsonWebKey & { kid?: string })[] }>(
          `${this.host}/api/jwks`,
        );
        const keys = new Map<string, KeyObject>();
        for (const jwk of data?.keys ?? []) {
          if (jwk.kid) keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
        }
        this.jwks = keys;
        this.jwksFetchedAt = Date.now();
      } catch (error: any) {
        this.logger.error(`Яндекс Пэй: не удалось получить JWKS: ${error.message}`);
      }
    }
    return this.jwks.get(kid) ?? null;
  }
}
