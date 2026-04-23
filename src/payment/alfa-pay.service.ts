import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface AlfaRegisterParams {
  orderNumber: string;
  amount: number; // в рублях (будет сконвертировано в копейки)
  description?: string;
  returnUrl: string;
  failUrl?: string;
  email?: string;
}

export interface AlfaRegisterResult {
  orderId: string; // mdOrder (UUID от банка)
  formUrl: string; // куда редиректить клиента
}

/**
 * Маппинг orderStatus из Alfa RBS → внутренний статус
 * 0 = registered, 1 = pre-authorized, 2 = deposited (paid),
 * 3 = auth cancelled, 4 = refunded, 5 = ACS initiated, 6 = declined
 */
const ALFA_STATUS_MAP: Record<number, 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED'> = {
  0: 'PENDING',
  1: 'PENDING',
  2: 'PAID',
  3: 'CANCELED',
  4: 'REFUNDED',
  5: 'PENDING',
  6: 'FAILED',
};

@Injectable()
export class AlfaPayService {
  private readonly logger = new Logger(AlfaPayService.name);
  private readonly baseUrl: string;
  private readonly userName: string;
  private readonly password: string;
  private readonly currency: string;

  constructor() {
    this.baseUrl = (process.env.ALFA_BASE_URL || 'https://alfa.rbsuat.com').replace(/\/+$/, '');
    this.userName = process.env.ALFA_API_USERNAME || '';
    this.password = process.env.ALFA_API_PASSWORD || '';
    // В процессинге Альфы RUB = 810 (легаси), не 643.
    // Другие валюты: 933=BYN, 840=USD, 398=KZT.
    this.currency = process.env.ALFA_CURRENCY || '810';

    if (!this.userName || !this.password) {
      this.logger.warn('ALFA_API_USERNAME/ALFA_API_PASSWORD не заданы — платежи Alfa работать не будут');
    }
  }

  /**
   * Зарегистрировать заказ в Alfa и получить URL платежной формы
   */
  async registerOrder(params: AlfaRegisterParams): Promise<AlfaRegisterResult> {
    const body = new URLSearchParams({
      userName: this.userName,
      password: this.password,
      orderNumber: params.orderNumber,
      amount: Math.round(params.amount * 100).toString(), // в копейках
      currency: this.currency,
      returnUrl: params.returnUrl,
      ...(params.failUrl && { failUrl: params.failUrl }),
      ...(params.description && { description: params.description.slice(0, 598) }),
      ...(params.email && { email: params.email }),
    });

    const url = `${this.baseUrl}/payment/rest/register.do`;

    try {
      const { data } = await axios.post(url, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      if (data.errorCode && data.errorCode !== '0') {
        this.logger.error(
          `Alfa register error: code=${data.errorCode}, message=${data.errorMessage}`,
        );
        throw new Error(`Alfa error ${data.errorCode}: ${data.errorMessage}`);
      }

      this.logger.log(
        `Платеж зарегистрирован в Alfa: orderNumber=${params.orderNumber}, mdOrder=${data.orderId}`,
      );

      return {
        orderId: data.orderId,
        formUrl: data.formUrl,
      };
    } catch (error: any) {
      const msg = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`Не удалось зарегистрировать платеж в Alfa: ${msg}`);
      throw new Error('Alfa registration failed');
    }
  }

  /**
   * Получить расширенный статус заказа по mdOrder или orderNumber
   */
  async getOrderStatus(args: { orderId?: string; orderNumber?: string }): Promise<{
    orderStatus: number | null;
    mappedStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED';
    raw: any;
  }> {
    if (!args.orderId && !args.orderNumber) {
      throw new Error('orderId или orderNumber обязателен');
    }

    const body = new URLSearchParams({
      userName: this.userName,
      password: this.password,
      ...(args.orderId && { orderId: args.orderId }),
      ...(args.orderNumber && { orderNumber: args.orderNumber }),
    });

    const url = `${this.baseUrl}/payment/rest/getOrderStatusExtended.do`;

    try {
      const { data } = await axios.post(url, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      if (data.errorCode && data.errorCode !== '0') {
        this.logger.error(
          `Alfa status error: code=${data.errorCode}, message=${data.errorMessage}`,
        );
        throw new Error(`Alfa error ${data.errorCode}: ${data.errorMessage}`);
      }

      const orderStatus: number | null =
        typeof data.orderStatus === 'number' ? data.orderStatus : null;
      const mappedStatus =
        orderStatus !== null ? ALFA_STATUS_MAP[orderStatus] ?? 'PENDING' : 'PENDING';

      return { orderStatus, mappedStatus, raw: data };
    } catch (error: any) {
      const msg = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`Не удалось получить статус платежа Alfa: ${msg}`);
      throw new Error('Alfa status request failed');
    }
  }
}
