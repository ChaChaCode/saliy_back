import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { YandexPayService } from './yandex-pay.service';
import { OrdersService } from '../orders/orders.service';
import { EmailService } from '../common/email/email.service';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly yandexPayService: YandexPayService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Webhook от Yandex Pay для уведомлений о статусе оплаты
   * POST /api/payment/webhook/yandex
   */
  @Post('webhook/yandex')
  async handleYandexPayWebhook(
    @Body() body: any,
    @Headers('x-yandex-pay-signature') signature: string,
  ) {
    this.logger.log('Получен webhook от Yandex Pay');
    this.logger.log(JSON.stringify(body, null, 2));

    // Проверяем подпись
    const isValid = this.yandexPayService.verifyWebhookSignature(
      JSON.stringify(body),
      signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    const { event, object } = body;

    // Обрабатываем событие ORDER_STATUS_UPDATED
    if (event === 'ORDER_STATUS_UPDATED') {
      const orderId = object.id;
      const status = object.status;

      this.logger.log(`Статус заказа ${orderId}: ${status}`);

      // Обновляем статус заказа в БД
      await this.ordersService.updatePaymentStatus(orderId, status);

      // Если оплата успешна - отправляем email
      if (status === 'CAPTURED') {
        const order = await this.ordersService.getOrderByNumber(orderId);
        if (order) {
          await this.emailService.sendPaymentSuccess(
            order.email,
            order.orderNumber,
            order.firstName,
          );
        }
      }
    }

    return { success: true };
  }

  /**
   * Проверить статус платежа вручную
   * POST /api/payment/check-status
   */
  @Post('check-status')
  async checkPaymentStatus(@Body() body: { orderId: string }) {
    const status = await this.yandexPayService.getPaymentStatus(body.orderId);
    await this.ordersService.updatePaymentStatus(body.orderId, status);
    return { orderId: body.orderId, status };
  }
}
