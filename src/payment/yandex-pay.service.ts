import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface YandexPayOrder {
  orderId: string;
  amount: number;
  description: string;
  returnUrl: string;
}

@Injectable()
export class YandexPayService {
  private readonly logger = new Logger(YandexPayService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly isSandbox: boolean;

  constructor() {
    this.isSandbox = process.env.YANDEX_PAY_SANDBOX === 'true';
    this.apiKey = this.isSandbox
      ? process.env.YANDEX_PAY_SANDBOX_API_KEY!
      : process.env.YANDEX_PAY_API_KEY!;
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.pay.yandex.ru/api/merchant'
      : 'https://pay.yandex.ru/api/merchant';
  }

  /**
   * Создать платеж в Yandex Pay
   */
  async createPayment(orderData: YandexPayOrder): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/orders`,
        {
          orderId: orderData.orderId,
          amount: {
            value: orderData.amount.toFixed(2),
            currency: 'RUB',
          },
          description: orderData.description,
          metadata: {
            orderNumber: orderData.orderId,
          },
          confirmation: {
            type: 'redirect',
            returnUrl: orderData.returnUrl,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Api-Key ${this.apiKey}`,
          },
        },
      );

      const paymentUrl = response.data.confirmation?.confirmationUrl;

      this.logger.log(
        `Платеж создан: orderId=${orderData.orderId}, paymentUrl=${paymentUrl}`,
      );

      return paymentUrl;
    } catch (error: any) {
      this.logger.error(
        `Ошибка создания платежа: ${error.message}`,
        error.response?.data,
      );
      throw new Error('Не удалось создать платеж');
    }
  }

  /**
   * Получить статус платежа
   */
  async getPaymentStatus(orderId: string): Promise<string> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/orders/${orderId}`,
        {
          headers: {
            Authorization: `Api-Key ${this.apiKey}`,
          },
        },
      );

      const status = response.data.status;
      this.logger.log(`Статус платежа ${orderId}: ${status}`);

      return status; // PENDING, CAPTURED, FAILED, CANCELED
    } catch (error: any) {
      this.logger.error(
        `Ошибка получения статуса платежа: ${error.message}`,
      );
      throw new Error('Не удалось получить статус платежа');
    }
  }

  /**
   * Проверить подпись webhook от Yandex Pay
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    // TODO: Реализовать проверку подписи по документации Yandex Pay
    // Пока просто логируем
    this.logger.log(`Webhook signature: ${signature}`);
    return true;
  }
}
