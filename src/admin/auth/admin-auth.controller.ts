import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from '../../common/guards/admin.guard';

const ADMIN_COOKIE_NAME = 'adminToken';
const ADMIN_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 часа

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
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 запросов в минуту
  async requestLogin(@Req() request: Request) {
    const ip = this.getClientIP(request);
    const userAgent = request.headers['user-agent'] || '';

    return this.adminAuthService.requestLogin(ip, userAgent);
  }

  /**
   * Проверить статус входа (для polling)
   * GET /admin/auth/check-status/:loginId
   *
   * Когда вход подтверждён — ставит httpOnly cookie и НЕ возвращает токен в body.
   */
  @Get('check-status/:loginId')
  async checkStatus(
    @Param('loginId') loginId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminAuthService.checkStatus(loginId);

    if (result.approved && result.token) {
      this.setAdminCookie(res, result.token);
      return { approved: true };
    }

    return { approved: false };
  }

  /**
   * Обновить токен
   * POST /admin/auth/refresh
   * Требует авторизацию
   */
  @Post('refresh')
  @UseGuards(AdminGuard)
  async refreshToken(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.extractToken(request);
    const result = await this.adminAuthService.refreshToken(token);
    this.setAdminCookie(res, result.token);
    return { success: true, expiresIn: result.expiresIn };
  }

  /**
   * Выход (очистить cookie и отозвать токен)
   * POST /admin/auth/logout
   */
  @Post('logout')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.extractToken(request);
    if (token) {
      await this.adminAuthService.revokeToken(token);
    }
    res.clearCookie(ADMIN_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });
    return { success: true };
  }

  /**
   * Поставить админский httpOnly cookie
   */
  private setAdminCookie(res: Response, token: string) {
    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: '/',
    });
  }

  /**
   * Извлечь токен из cookie или из заголовка
   */
  private extractToken(request: any): string {
    const cookieToken = request.cookies?.adminToken;
    if (cookieToken) return cookieToken;
    return this.extractTokenFromHeader(request);
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
