import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private adminAuthService: AdminAuthService) {}

  /**
   * Запросить вход через Telegram
   * POST /admin/auth/request-login
   * Rate limit: 5 запросов в 10 минут
   */
  @Post('request-login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 600000 } }) // 5 запросов в 10 минут
  async requestLogin(@Req() request: Request) {
    const ip = this.getClientIP(request);
    const userAgent = request.headers['user-agent'] || '';

    return this.adminAuthService.requestLogin(ip, userAgent);
  }

  /**
   * Проверить статус входа (для polling)
   * GET /admin/auth/check-status/:loginId
   */
  @Get('check-status/:loginId')
  async checkStatus(@Param('loginId') loginId: string) {
    return this.adminAuthService.checkStatus(loginId);
  }

  /**
   * Обновить токен
   * POST /admin/auth/refresh
   * Требует авторизацию
   */
  @Post('refresh')
  @UseGuards(AdminGuard)
  async refreshToken(@Req() request: Request) {
    const token = this.extractTokenFromHeader(request);
    return this.adminAuthService.refreshToken(token);
  }

  /**
   * Получить IP клиента
   */
  private getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.ip ||
      request.connection?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Извлечь токен из заголовка
   */
  private extractTokenFromHeader(request: any): string {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : '';
  }
}
