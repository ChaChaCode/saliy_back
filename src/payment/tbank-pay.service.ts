import { Injectable, BadGatewayException } from '@nestjs/common';
import axios from 'axios';
import { createHash, timingSafeEqual } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { Agent } from 'https';
import { rootCertificates } from 'tls';
import { join } from 'path';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUNDED';
interface BankResponse {
  Success: boolean;
  ErrorCode: string;
  PaymentId: string;
  OrderId: string;
  Amount: number;
  Status: string;
  PaymentURL?: string;
}
@Injectable()
export class TbankPayService {
  private readonly terminalKey = process.env.TBANK_TERMINAL_KEY || '';
  private readonly password = process.env.TBANK_PASSWORD || '';
  private readonly baseUrl = (
    process.env.TBANK_BASE_URL || 'https://securepay.tinkoff.ru/v2'
  ).replace(/\/+$/, '');
  private readonly http = axios.create({
    timeout: 15000,
    httpsAgent: new Agent({
      ca: [
        ...rootCertificates,
        ...(existsSync(join(process.cwd(), 'certs/russian_trusted_root_ca.pem'))
          ? [
              readFileSync(
                join(process.cwd(), 'certs/russian_trusted_root_ca.pem'),
                'utf8',
              ),
            ]
          : []),
      ],
    }),
  });
  createToken(payload: Record<string, unknown>): string {
    const values: Record<string, unknown> = {
      ...payload,
      Password: this.password,
    };
    const text = Object.keys(values)
      .filter(
        (key) =>
          key !== 'Token' &&
          values[key] != null &&
          typeof values[key] !== 'object',
      )
      .sort()
      .map((key) => String(values[key]))
      .join('');
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
  verifyNotification(payload: Record<string, unknown>): boolean {
    if (
      !this.password ||
      payload.TerminalKey !== this.terminalKey ||
      typeof payload.Token !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(payload.Token)
    )
      return false;
    return timingSafeEqual(
      Buffer.from(payload.Token, 'hex'),
      Buffer.from(this.createToken(payload), 'hex'),
    );
  }
  private async request(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<BankResponse> {
    if (!this.terminalKey || !this.password)
      throw new BadGatewayException('Т-Банк не настроен');
    const body = { ...payload, TerminalKey: this.terminalKey };
    let data: BankResponse;
    try {
      ({ data } = await this.http.post<BankResponse>(
        this.baseUrl + '/' + method,
        { ...body, Token: this.createToken(body) },
      ));
    } catch {
      // Axios errors contain signed requests: do not expose them.
      throw new BadGatewayException('Т-Банк временно недоступен');
    }
    if (data?.Success !== true || String(data.ErrorCode) !== '0')
      throw new BadGatewayException('Т-Банк отклонил запрос');
    return data;
  }
  async registerOrder(params: {
    orderNumber: string;
    amount: number;
    successUrl: string;
    failUrl: string;
    ttlMinutes: number;
  }) {
    const amount = Math.round(params.amount * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new Error('Некорректная сумма платежа');
    const backend = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
    if (!backend) throw new Error('BACKEND_URL не задан');
    const data = await this.request('Init', {
      Amount: amount,
      OrderId: params.orderNumber,
      Description: 'Заказ ' + params.orderNumber,
      PayType: 'O',
      SuccessURL: params.successUrl,
      FailURL: params.failUrl,
      NotificationURL: backend + '/payment/tbank/webhook',
      RedirectDueDate: new Date(
        Date.now() + params.ttlMinutes * 60000,
      )
        .toISOString()
        .replace(/\.\d{3}Z$/, '+00:00'),
    });
    if (!data.PaymentId || !data.PaymentURL)
      throw new BadGatewayException('Т-Банк не вернул ссылку на оплату');
    return { paymentId: String(data.PaymentId), paymentUrl: data.PaymentURL };
  }
  getState(paymentId: string) {
    return this.request('GetState', { PaymentId: paymentId });
  }
  mapStatus(status: string): PaymentStatus {
    switch (status) {
      case 'CONFIRMED':
        return 'PAID';
      case 'REFUNDED':
        return 'REFUNDED';
      case 'REJECTED':
        return 'FAILED';
      case 'CANCELED':
      case 'REVERSED':
      case 'DEADLINE_EXPIRED':
        return 'CANCELED';
      default:
        return 'PENDING';
    }
  }
}
