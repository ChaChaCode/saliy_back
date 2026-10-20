import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { existsSync, readFileSync } from 'fs';
import { Agent } from 'https';
import { join } from 'path';
import { rootCertificates } from 'tls';

/**
 * Корневой сертификат Минцифры (Russian Trusted Root CA). С июня 2026 API Точки
 * отдаёт сертификат этого УЦ, которого нет в хранилище Node.js — без него
 * любой запрос падает с «self-signed certificate in certificate chain».
 */
const RU_ROOT_CA_PATH =
  process.env.TOCHKA_CA_CERT_PATH ||
  join(process.cwd(), 'certs', 'russian_trusted_root_ca.pem');

export interface TochkaRegisterParams {
  orderId: string; // наш orderNumber → paymentLinkId
  amount: number; // сумма в рублях
  description?: string; // назначение платежа (purpose)
  redirectUrl: string; // куда вернуть после успешной оплаты
  failRedirectUrl?: string; // куда вернуть при неуспехе
  ttlMinutes?: number; // срок жизни платёжной ссылки в минутах (1..44640)
}

export interface TochkaRegisterResult {
  orderId: string; // наш orderNumber
  paymentUrl: string; // paymentLink — готовая ссылка для оплаты
  operationId?: string; // id операции на стороне Точки
}

/**
 * Маппинг статуса вебхука Точки → внутренний статус.
 * acquiringInternetPayment.status: APPROVED — оплачен, AUTHORIZED — холд (двухстадийный).
 */
const TOCHKA_STATUS_MAP: Record<
  string,
  'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED'
> = {
  CREATED: 'PENDING',
  AUTHORIZED: 'PENDING',
  APPROVED: 'PAID',
  REFUNDED: 'REFUNDED',
  REFUNDED_PARTIALLY: 'REFUNDED',
  EXPIRED: 'CANCELED',
  CANCELLED: 'CANCELED',
  FAILED: 'FAILED',
};

/**
 * Приём оплаты через интернет-эквайринг Банка Точка.
 * Док: https://developers.tochka.com/docs/tochka-api/internet-acquiring-integration
 *
 * Создание платёжной ссылки: POST /acquiring/v1.0/payments с customerCode.
 * customerCode — уникальный код клиента (зашит в JWT-токене, берём из .env).
 * Авторизация — Bearer JWT из раздела «Интеграции и API». siteUid НЕ нужен.
 */
@Injectable()
export class TochkaPayService {
  private readonly logger = new Logger(TochkaPayService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly customerCode: string;
  private readonly merchantId: string;
  private readonly paymentModes: string[];
  private readonly http: AxiosInstance;

  constructor() {
    this.baseUrl = (
      process.env.TOCHKA_BASE_URL || 'https://enter.tochka.com/uapi'
    ).replace(/\/+$/, '');
    this.token = process.env.TOCHKA_JWT_TOKEN || '';
    this.customerCode = process.env.TOCHKA_CUSTOMER_CODE || '';
    this.merchantId = process.env.TOCHKA_MERCHANT_ID || '';
    // По умолчанию принимаем и СБП, и карту. Можно сузить через .env.
    this.paymentModes = (process.env.TOCHKA_PAYMENT_MODES || 'sbp,card')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!this.token || !this.customerCode) {
      this.logger.warn(
        'TOCHKA_JWT_TOKEN/TOCHKA_CUSTOMER_CODE не заданы — оплата через Точку работать не будет',
      );
    }

    // Доверяем УЦ Минцифры только для запросов к Точке, а не всему процессу
    let httpsAgent: Agent | undefined;
    if (existsSync(RU_ROOT_CA_PATH)) {
      httpsAgent = new Agent({
        ca: [...rootCertificates, readFileSync(RU_ROOT_CA_PATH, 'utf8')],
      });
    } else {
      this.logger.error(
        `Не найден сертификат Минцифры (${RU_ROOT_CA_PATH}) — запросы к Точке будут падать на TLS`,
      );
    }
    this.http = axios.create({ httpsAgent, timeout: 20000 });
  }

  /** Текст ошибки для логов и cancelReason, без падения на пустом ответе. */
  private describeError(e: unknown): string {
    if (axios.isAxiosError(e)) {
      if (!e.response) return `${e.code ?? 'NETWORK'}: ${e.message}`;
      const body = JSON.stringify(e.response.data) ?? '';
      return `HTTP ${e.response.status} ${body.slice(0, 300)}`;
    }
    return e instanceof Error ? e.message : String(e);
  }

  mapStatus(value: string): 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED' {
    return TOCHKA_STATUS_MAP[(value || '').toUpperCase()] || 'PENDING';
  }

  /**
   * Создать платёжную ссылку.
   * POST {base}/acquiring/v1.0/payments
   */
  async registerOrder(
    params: TochkaRegisterParams,
  ): Promise<TochkaRegisterResult> {
    // ttl — срок жизни ссылки в минутах. Точка допускает 1..44640 (по умолчанию 7 дней).
    // Привязываем к таймауту автоотмены заказа, чтобы ссылка протухала ровно когда
    // заказ отменяется и сток возвращается — нельзя оплатить уже отменённый заказ.
    const ttl =
      params.ttlMinutes != null
        ? Math.min(44640, Math.max(1, Math.round(params.ttlMinutes)))
        : undefined;

    const body = {
      Data: {
        customerCode: this.customerCode,
        amount: Number(params.amount.toFixed(2)),
        purpose: (params.description || `Оплата заказа ${params.orderId}`).slice(0, 140),
        redirectUrl: params.redirectUrl,
        ...(params.failRedirectUrl ? { failRedirectUrl: params.failRedirectUrl } : {}),
        paymentMode: this.paymentModes,
        // Наш orderNumber — вернётся в webhook как paymentLinkId.
        paymentLinkId: params.orderId.slice(0, 45),
        ...(this.merchantId ? { merchantId: this.merchantId } : {}),
        ...(ttl != null ? { ttl } : {}),
      },
    };

    try {
      const { data } = await this.http.post(
        `${this.baseUrl}/acquiring/v1.0/payments`,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      const d = data?.Data ?? data ?? {};
      const paymentUrl = d.paymentLink || '';
      const operationId = d.operationId;

      if (!paymentUrl) {
        throw new Error(
          `Точка не вернула paymentLink: ${(JSON.stringify(data) ?? '').slice(0, 300)}`,
        );
      }

      return { orderId: params.orderId, paymentUrl, operationId };
    } catch (e) {
      const msg = this.describeError(e);
      this.logger.error(`Ошибка создания платежа Точки: ${msg}`);
      // Наверх — понятный текст: он попадает в cancelReason заказа
      throw new Error(msg);
    }
  }

  /**
   * Получить статус операции по operationId.
   * GET {base}/acquiring/v1.0/payments/{operationId}
   */
  async getOperationStatus(
    operationId: string,
  ): Promise<{ rawStatus: string; mappedStatus: ReturnType<TochkaPayService['mapStatus']> }> {
    const { data } = await this.http.get(
      `${this.baseUrl}/acquiring/v1.0/payments/${operationId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
      },
    );
    const d = data?.Data ?? data ?? {};
    const rawStatus: string = d.status || d?.Operation?.[0]?.status || '';
    return { rawStatus, mappedStatus: this.mapStatus(rawStatus) };
  }
}
