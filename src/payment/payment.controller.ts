import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Logger,
  Res,
  Req,
  HttpCode,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AlfaPayService } from './alfa-pay.service';
import { YandexPayService } from './yandex-pay.service';
import { OrdersService } from '../orders/orders.service';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly alfaPayService: AlfaPayService,
    private readonly yandexPayService: YandexPayService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Callback от Alfa Bank — вызывается банком GET-запросом после изменения статуса платежа.
   * Query-параметры: mdOrder, orderNumber, operation, status, checksum
   * Подпись не проверяем (требует отдельного ключа) — подтверждаем статус обратным запросом.
   *
   * GET /api/payment/alfa/callback
   */
  @Get('alfa/callback')
  async handleAlfaCallback(
    @Query('mdOrder') mdOrder: string,
    @Query('orderNumber') orderNumber: string,
    @Query('operation') operation: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    this.logger.log(
      `Alfa callback: orderNumber=${orderNumber}, mdOrder=${mdOrder}, operation=${operation}, status=${status}`,
    );

    if (orderNumber || mdOrder) {
      try {
        const { mappedStatus } = await this.alfaPayService.getOrderStatus({
          orderId: mdOrder,
          orderNumber,
        });
        if (orderNumber) {
          await this.ordersService.updatePaymentStatus(orderNumber, mappedStatus);
        }
      } catch (error: any) {
        this.logger.error(`Ошибка обработки Alfa callback: ${error.message}`);
      }
    }

    res.status(200).send('OK');
  }

  /**
   * Проверить статус платежа вручную (на случай если callback потерялся)
   * POST /api/payment/alfa/check-status
   * body: { orderNumber: string }
   */
  @Post('alfa/check-status')
  @HttpCode(200)
  async checkAlfaPaymentStatus(@Body() body: { orderNumber: string }) {
    const { orderStatus, mappedStatus } = await this.alfaPayService.getOrderStatus({
      orderNumber: body.orderNumber,
    });
    await this.ordersService.updatePaymentStatus(body.orderNumber, mappedStatus);
    return { orderNumber: body.orderNumber, orderStatus, status: mappedStatus };
  }

  /**
   * Webhook от Яндекс Пэй — приходит как application/octet-stream с JWT внутри.
   * Подпись (ES256) пока не проверяем — вместо этого pull-ом подтверждаем статус через API.
   *
   * POST /api/payment/yandex/webhook
   */
  @Post('yandex/webhook')
  @HttpCode(200)
  async handleYandexPayWebhook(@Req() req: Request) {
    const rawBody: any = (req as any).body;
    let payload: any = null;

    try {
      // Multer/express по умолчанию парсит JSON. Если пришёл application/octet-stream — будет Buffer/строка.
      if (Buffer.isBuffer(rawBody)) {
        payload = this.decodeJwtPayload(rawBody.toString('utf8'));
      } else if (typeof rawBody === 'string') {
        payload = this.decodeJwtPayload(rawBody);
      } else if (rawBody?.event) {
        // Уже JSON (если когда-то Yandex начнёт слать в открытом виде)
        payload = rawBody;
      } else {
        this.logger.warn(`Yandex webhook: неподдерживаемый формат тела`);
        return { status: 'success' };
      }
    } catch (error: any) {
      this.logger.error(`Yandex webhook: не смог разобрать JWT: ${error.message}`);
      return { status: 'success' };
    }

    this.logger.log(`Yandex Pay webhook event: ${payload?.event}`);

    if (
      payload?.event === 'ORDER_STATUS_UPDATED' ||
      payload?.event === 'OPERATION_STATUS_UPDATED'
    ) {
      // orderId в payload — это наш orderNumber, который мы передавали при регистрации
      const orderNumber: string | undefined =
        payload?.order?.orderId || payload?.operation?.orderId;
      if (orderNumber) {
        try {
          // Подтягиваем статус через API (единственный источник правды без проверки подписи)
          const { mappedStatus } = await this.yandexPayService.getOrderStatus(orderNumber);
          await this.ordersService.updatePaymentStatus(orderNumber, mappedStatus);
        } catch (error: any) {
          this.logger.error(`Yandex webhook: ошибка обновления заказа: ${error.message}`);
        }
      }
    }

    return { status: 'success' };
  }

  /**
   * Ручная синхронизация статуса заказа в Яндекс Пэй
   * POST /api/payment/yandex/check-status
   * body: { orderNumber: string }
   */
  @Post('yandex/check-status')
  @HttpCode(200)
  async checkYandexPayStatus(@Body() body: { orderNumber: string }) {
    const { rawStatus, mappedStatus } = await this.yandexPayService.getOrderStatus(
      body.orderNumber,
    );
    await this.ordersService.updatePaymentStatus(body.orderNumber, mappedStatus);
    return {
      orderNumber: body.orderNumber,
      yandexStatus: rawStatus,
      status: mappedStatus,
    };
  }

  /**
   * JWT-токен в формате header.payload.signature — берём payload (base64url) и парсим JSON.
   * Подпись пока не проверяем (требует ES256-публичного ключа Яндекса).
   */
  private decodeJwtPayload(token: string): any {
    const trimmed = token.trim();
    const parts = trimmed.split('.');
    if (parts.length < 2) {
      throw new Error('not a JWT');
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  }
}
