import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OrdersService } from '../orders/orders.service';
import { TbankPayService } from './tbank-pay.service';
import { YandexPayService } from './yandex-pay.service';
import { readRawBody } from './raw-body.util';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);
  constructor(
    private readonly tbank: TbankPayService,
    private readonly yandex: YandexPayService,
    @Inject(forwardRef(() => OrdersService))
    private readonly orders: OrdersService,
  ) {}
  @Post('tbank/webhook')
  @HttpCode(200)
  async webhook(@Body() body: Record<string, unknown>, @Res() res: Response) {
    if (!body || !this.tbank.verifyNotification(body)) {
      // Только имена и типы полей: значения (Pan, Token) в лог не пишем.
      if (body && typeof body === 'object') {
        const shape = Object.keys(body)
          .sort()
          .map((key) => {
            const v = body[key];
            const type =
              v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
            return `${key}:${type}`;
          })
          .join(',');
        this.logger.warn(
          `Т-Банк webhook: неверная подпись; Status=${String(body.Status)}, ` +
            `TerminalKey=${String(body.TerminalKey)}, поля=${shape}`,
        );
      }
      throw new ForbiddenException('Неверная подпись');
    }
    if (
      typeof body.OrderId !== 'string' ||
      !['string', 'number'].includes(typeof body.PaymentId)
    )
      throw new BadRequestException('Некорректное уведомление');
    await this.orders.confirmTbankByApi(
      body.OrderId,
      String(body.PaymentId),
      this.tbank.describeDecline(body),
    );
    res.status(200).type('text/plain').send('OK');
  }

  /**
   * Уведомление Яндекс Пэй. Яндекс сам дописывает /v1/webhook к Callback URL,
   * поэтому в кабинете указывается https://<домен>/api/payment/yandex.
   * Телу не доверяем: после проверки подписи статус перечитывается из API.
   * Ответ не 200 Яндекс повторяет до суток, поэтому 400 — только для
   * поддельных уведомлений и ошибок, которые стоит повторить.
   */
  @Post('yandex/v1/webhook')
  @HttpCode(200)
  async yandexWebhook(@Req() req: Request) {
    const payload = await this.yandex.verifyWebhookToken(
      (await readRawBody(req, 16 * 1024)).trim(),
    );
    if (!payload) {
      this.logger.warn('Яндекс Пэй webhook: подпись или мерчант не прошли проверку');
      throw new BadRequestException({
        status: 'fail',
        reasonCode: 'UNAUTHORIZED',
        reason: 'Invalid token',
      });
    }
    const orderNumber = payload.order?.orderId ?? payload.operation?.orderId;
    if (typeof orderNumber === 'string')
      await this.orders.confirmYandexByApi(orderNumber);
    return { status: 'success' };
  }
}
