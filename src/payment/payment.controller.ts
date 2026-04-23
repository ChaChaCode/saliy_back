import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Logger,
  Res,
  HttpCode,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import { AlfaPayService } from './alfa-pay.service';
import { OrdersService } from '../orders/orders.service';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly alfaPayService: AlfaPayService,
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
}
