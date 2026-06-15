import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface TochkaRegisterParams {
  orderId: string; // наш orderNumber
  amount: number; // сумма в рублях
  description?: string; // назначение платежа
  redirectUrl: string; // куда вернуть клиента после оплаты
}

export interface TochkaRegisterResult {
  orderId: string; // наш orderNumber
  paymentUrl: string; // qrCodeUrl — ссылка/QR для оплаты по СБП
  qrcId?: string; // идентификатор QR в системе Точки
}

/**
 * Маппинг статуса платежа Точки → внутренний статус.
 * payload.status.value из webhook: COMPLETED — оплачен.
 * Возможные значения статуса операции СБП.
 */
const TOCHKA_STATUS_MAP: Record<
  string,
  'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED'
> = {
  CREATED: 'PENDING',
  PENDING: 'PENDING',
  COMPLETED: 'PAID',
  CONFIRMED: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'CANCELED',
  CANCELLED: 'CANCELED',
  REFUNDED: 'REFUNDED',
};

/**
 * Приём оплаты по СБП через Tochka Pay Gateway.
 * Док: https://developers.tochka.com/docs/pay-gateway
 *
 * Авторизация — статичный JWT-токен из раздела «Интеграции и API» Точки
 * (Bearer). siteUid — ID сайта в Tochka Pay. Оба берутся из .env.
 */
@Injectable()
export class TochkaPayService {
  private readonly logger = new Logger(TochkaPayService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly siteUid: string;

  constructor() {
    this.baseUrl = (
      process.env.TOCHKA_BASE_URL || 'https://enter.tochka.com/uapi/pay/v1.0'
    ).replace(/\/+$/, '');
    this.token = process.env.TOCHKA_JWT_TOKEN || '';
    this.siteUid = process.env.TOCHKA_SITE_UID || '';

    if (!this.token || !this.siteUid) {
      this.logger.warn(
        'TOCHKA_JWT_TOKEN/TOCHKA_SITE_UID не заданы — оплата через Точку работать не будет',
      );
    }
  }

  mapStatus(value: string): 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED' {
    return TOCHKA_STATUS_MAP[(value || '').toUpperCase()] || 'PENDING';
  }

  /**
   * Создать динамический СБП QR-код (платёжную ссылку).
   * POST {base}/sites/{siteUid}/sbp/qrc
   */
  async registerOrder(
    params: TochkaRegisterParams,
  ): Promise<TochkaRegisterResult> {
    const callbackUrl = `${(process.env.BACKEND_URL || '').replace(/\/+$/, '')}/payment/tochka/webhook`;

    const body = {
      Data: {
        qrcType: 'DYNAMIC',
        imageParams: { mediaType: 'image/png', width: 300, height: 300 },
        redirectUrl: params.redirectUrl,
        callbackUrl,
        // Наш orderNumber кладём в metadata — вернётся в webhook, по нему
        // находим заказ (в payload webhook своих orderUid от Точки).
        metadata: JSON.stringify({ orderNumber: params.orderId }),
        amount: {
          currency: 'RUB',
          amount: params.amount.toFixed(2),
        },
        paymentPurpose: (params.description || `Оплата заказа ${params.orderId}`).slice(0, 140),
        ttl: 60,
      },
    };

    try {
      const { data } = await axios.post(
        `${this.baseUrl}/sites/${this.siteUid}/sbp/qrc`,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      // Ответ Точки: { Data: { qrCodeUrl, qrcId, ... } } либо плоско.
      const d = data?.Data ?? data ?? {};
      const paymentUrl = d.qrCodeUrl || d.payload || '';
      const qrcId = d.qrcId || d.merchantQrcId;

      if (!paymentUrl) {
        throw new Error(`Точка не вернула qrCodeUrl: ${JSON.stringify(data).slice(0, 300)}`);
      }

      return { orderId: params.orderId, paymentUrl, qrcId };
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? `${e.response?.status} ${JSON.stringify(e.response?.data).slice(0, 300)}`
        : e instanceof Error
          ? e.message
          : String(e);
      this.logger.error(`Ошибка создания СБП-платежа Точки: ${msg}`);
      throw e;
    }
  }
}
