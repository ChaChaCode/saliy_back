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
  Message?: string;
  Details?: string;
  OriginalAmount?: number;
  NewAmount?: number;
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
    exposeBankMessage = false,
    acceptDeclineCode = false,
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
    if (
      data?.Success !== true ||
      (!acceptDeclineCode && String(data.ErrorCode) !== '0')
    ) {
      // Текст отказа банка (без подписи и ключей) нужен админу, чтобы понять,
      // почему не прошёл возврат: например, не хватает оборота на терминале.
      const reason = exposeBankMessage
        ? [data?.ErrorCode, data?.Message, data?.Details]
            .filter((v) => v != null && String(v) !== '' && v !== 'None')
            .join(', ')
        : '';
      throw new BadGatewayException(
        'Т-Банк отклонил запрос' + (reason ? ': ' + reason.slice(0, 300) : ''),
      );
    }
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
  /**
   * Возврат денег по оплаченному платежу (метод Cancel). amountKopecks — сколько
   * вернуть. Полный возврат переводит платёж в REFUNDED, частичный —
   * в PARTIAL_REFUNDED.
   */
  refundPayment(paymentId: string, amountKopecks: number) {
    if (!Number.isSafeInteger(amountKopecks) || amountKopecks <= 0)
      throw new Error('Некорректная сумма возврата');
    return this.request(
      'Cancel',
      { PaymentId: paymentId, Amount: amountKopecks },
      true,
    );
  }
  // Пока покупатель пробует оплатить, GetState отклонённой попытки отвечает
  // Success=true с кодом отказа в ErrorCode. Это состояние платежа, а не сбой
  // запроса: раньше такой ответ считался ошибкой, и отказ не доходил до заказа.
  getState(paymentId: string) {
    return this.request('GetState', { PaymentId: paymentId }, false, true);
  }

  /**
   * Причина отказа из уведомления или GetState: «Текст (код N)». У успешных
   * и ещё не оплаченных платежей ErrorCode = 0 — тогда причины нет.
   */
  describeDecline(data: {
    ErrorCode?: unknown;
    Message?: unknown;
    Details?: unknown;
  }): string | undefined {
    const code = data.ErrorCode == null ? '' : String(data.ErrorCode);
    if (!code || code === '0') return undefined;
    const text = [data.Message, data.Details].find(
      (v): v is string => typeof v === 'string' && v.trim() !== '' && v !== 'None',
    );
    return `${(text ?? 'Отказ банка').trim().replace(/\.$/, '')} (код ${code})`.slice(
      0,
      300,
    );
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
