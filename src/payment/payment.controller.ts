import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Logger,
  Post,
  Res,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrdersService } from '../orders/orders.service';
import { TbankPayService } from './tbank-pay.service';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);
  constructor(
    private readonly tbank: TbankPayService,
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
    await this.orders.confirmTbankByApi(body.OrderId, String(body.PaymentId));
    res.status(200).type('text/plain').send('OK');
  }
}
