import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsEmail,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { NewsletterService } from './newsletter.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SubscribeDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;

  @IsBoolean()
  acceptedTerms: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  /**
   * Подписаться на рассылку.
   * POST /api/newsletter/subscribe
   * Требует авторизацию. Подписаться можно только на СВОЮ почту — ту, под
   * которой пользователь вошёл. Иначе ошибка с просьбой ввести свою почту.
   * Throttle: 5 попыток в минуту с одного IP — защита от спама.
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  subscribe(@Body() dto: SubscribeDto, @Req() request: any) {
    const userEmail = (request.user?.email || '').trim().toLowerCase();
    const inputEmail = dto.email.trim().toLowerCase();

    if (!userEmail || inputEmail !== userEmail) {
      throw new BadRequestException('Можно подписать только свою почту');
    }

    return this.newsletterService.subscribe(dto);
  }

  /**
   * Отписаться по токену из письма (one-click из почтового клиента).
   * GET /api/newsletter/unsubscribe/:token
   * Возвращает HTML-страничку, чтобы юзер увидел понятное сообщение в браузере.
   */
  @Get('unsubscribe/:token')
  async unsubscribe(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    let message: string;
    try {
      const result = await this.newsletterService.unsubscribeByToken(token);
      message = result.message;
    } catch (error: any) {
      message = error?.message || 'Подписка не найдена';
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Отписка от рассылки</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #111;">
  <h2>SALIY</h2>
  <p style="font-size: 16px; line-height: 1.5;">${message}</p>
  <a href="${process.env.FRONTEND_URL || '/'}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #111; color: #fff; text-decoration: none;">На сайт</a>
</body>
</html>`);
  }
}
