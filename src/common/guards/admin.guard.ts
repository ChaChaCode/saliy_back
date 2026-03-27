import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SimpleCacheService } from '../cache/simple-cache.service';
import { PrismaService } from '../../prisma/prisma.service';

interface FailedAttempt {
  count: number;
  blockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 10;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 минут
const TELEGRAM_SECRET_CHANNEL_ID = '-1003644248789';

// Cache ключи
const FAILED_ATTEMPTS_PREFIX = 'admin:failed_attempts:';
const REVOKED_TOKEN_PREFIX = 'admin:revoked_token:';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private cacheService: SimpleCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.getClientIP(request);
    const userAgent = request.headers['user-agent'] || '';
    const authHeader = request.headers['authorization'];

    // Проверяем постоянную блокировку
    const dbBlock = await this.checkDatabaseBlock(ip);
    if (dbBlock.blocked) {
      this.logger.warn(`Permanently blocked IP ${ip} attempted access`);
      throw new HttpException(
        {
          message: 'IP заблокирован. Обратитесь к администратору.',
          error: 'IP Blocked',
          statusCode: HttpStatus.FORBIDDEN,
          blockedAt: dbBlock.blockedAt,
          reason: dbBlock.reason,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Проверяем временную блокировку
    const tempBlock = await this.checkTempBlock(ip);
    if (tempBlock.blocked) {
      this.logger.warn(
        `Temp blocked IP ${ip} attempted access. Unblock in ${tempBlock.remainingSeconds}s`,
      );
      throw new HttpException(
        {
          message: 'Слишком много неудачных попыток. Попробуйте позже.',
          error: 'Too Many Failed Attempts',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          retryAfter: tempBlock.remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!authHeader) {
      await this.recordFailedAttempt(ip, userAgent);
      throw new UnauthorizedException('Требуется авторизация');
    }

    try {
      // Только Bearer токен (вход через Telegram)
      if (!authHeader.startsWith('Bearer ')) {
        await this.recordFailedAttempt(ip, userAgent);
        throw new UnauthorizedException('Требуется авторизация через Telegram');
      }

      const result = await this.validateBearerToken(request, authHeader);

      // Успешная авторизация - сбрасываем счётчик
      if (result) {
        await this.clearFailedAttempts(ip);
      }

      return result;
    } catch (error) {
      // Записываем неудачную попытку только для auth ошибок
      if (error instanceof UnauthorizedException) {
        await this.recordFailedAttempt(ip, userAgent);
      }
      throw error;
    }
  }

  /**
   * Проверка Bearer токена (вход по секретному коду)
   */
  private async validateBearerToken(
    request: any,
    authHeader: string,
  ): Promise<boolean> {
    const token = authHeader.slice(7);

    try {
      // Проверяем, не отозван ли токен
      const revokedKey = `${REVOKED_TOKEN_PREFIX}${token}`;
      if (await this.cacheService.has(revokedKey)) {
        this.logger.warn('Attempt to use revoked token');
        throw new UnauthorizedException('Токен был отозван');
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ADMIN_SECRET || 'admin-secret-key',
        algorithms: ['HS256'],
      });

      // Проверяем что это админский токен
      if (payload.type !== 'admin') {
        throw new UnauthorizedException('Недействительный тип токена');
      }

      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Администратор не найден или неактивен');
      }

      request.admin = {
        id: admin.id,
        name: admin.name,
        role: admin.role,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Недействительный или истёкший токен');
    }
  }

  /**
   * Получение IP клиента
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
   * Проверка постоянной блокировки (через Cache)
   */
  private async checkDatabaseBlock(
    ip: string,
  ): Promise<{ blocked: boolean; blockedAt?: Date; reason?: string }> {
    const blockKey = `admin:permanent_block:${ip}`;
    const blockData = await this.cacheService.get<{
      blockedAt: string;
      reason: string;
    }>(blockKey);

    if (blockData) {
      return {
        blocked: true,
        blockedAt: new Date(blockData.blockedAt),
        reason: blockData.reason || 'Заблокировано администратором',
      };
    }

    return { blocked: false };
  }

  /**
   * Проверка временной блокировки
   */
  private async checkTempBlock(ip: string): Promise<{
    blocked: boolean;
    remainingSeconds: number;
  }> {
    const attemptKey = `${FAILED_ATTEMPTS_PREFIX}${ip}`;
    const attempt = await this.cacheService.get<FailedAttempt>(attemptKey);

    if (!attempt || !attempt.blockedUntil) {
      return { blocked: false, remainingSeconds: 0 };
    }

    const now = Date.now();
    if (now < attempt.blockedUntil) {
      return {
        blocked: true,
        remainingSeconds: Math.ceil((attempt.blockedUntil - now) / 1000),
      };
    }

    // Блокировка истекла - очищаем
    await this.cacheService.delete(attemptKey);
    return { blocked: false, remainingSeconds: 0 };
  }

  /**
   * Записать неудачную попытку
   */
  private async recordFailedAttempt(
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    const attemptKey = `${FAILED_ATTEMPTS_PREFIX}${ip}`;
    const existing = await this.cacheService.get<FailedAttempt>(attemptKey);
    const attempt = existing || { count: 0, blockedUntil: null };
    attempt.count++;

    if (attempt.count >= MAX_FAILED_ATTEMPTS) {
      attempt.blockedUntil = Date.now() + BLOCK_DURATION_MS;
      this.logger.warn(
        `IP ${ip} blocked for 15 minutes after ${attempt.count} failed attempts`,
      );

      // Отправляем уведомление в Telegram
      this.sendBruteforceAlert(ip, userAgent, attempt.count);
    }

    await this.cacheService.set(attemptKey, attempt, BLOCK_DURATION_MS);
    this.logger.debug(
      `Failed attempt ${attempt.count}/${MAX_FAILED_ATTEMPTS} from IP ${ip}`,
    );
  }

  /**
   * Отправляет уведомление о брутфорсе в Telegram
   */
  private async sendBruteforceAlert(
    ip: string,
    userAgent?: string,
    attempts?: number,
  ): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, skipping bruteforce alert');
      return;
    }

    const geo = await this.getGeoLocation(ip);
    const now = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
    });
    const browserInfo = userAgent
      ? this.parseUserAgent(userAgent)
      : 'Неизвестно';

    const message = `
⚠️ *Подозрительная активность*

🚨 *Попытка брутфорса админки!*

📍 *IP:* \`${ip}\`
🌍 *Локация:* ${geo.city}, ${geo.country}
🏢 *Провайдер:* ${geo.isp}
🌐 *Браузер:* ${browserInfo}
🔢 *Попыток:* ${attempts || MAX_FAILED_ATTEMPTS}
🕐 *Время (МСК):* ${now}

⏱ IP временно заблокирован на 15 минут
    `.trim();

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_SECRET_CHANNEL_ID,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔓 Разблокировать',
                  callback_data: `admin_unblock:${ip}`,
                },
                {
                  text: '🚫 Заблокировать навсегда',
                  callback_data: `admin_block_bruteforce:${ip}`,
                },
              ],
            ],
          },
        }),
      });
    } catch (error) {
      this.logger.error(`Failed to send bruteforce alert: ${error.message}`);
    }
  }

  /**
   * Получает геолокацию по IP
   */
  private async getGeoLocation(
    ip: string,
  ): Promise<{ country: string; city: string; isp: string }> {
    try {
      if (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.startsWith('192.168.') ||
        ip.startsWith('10.')
      ) {
        return { country: 'Local', city: 'Local', isp: 'Local Network' };
      }

      const response = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,city,isp&lang=ru`,
      );
      const data = await response.json();

      if (data.status === 'success') {
        return {
          country: data.country || 'Неизвестно',
          city: data.city || 'Неизвестно',
          isp: data.isp || 'Неизвестно',
        };
      }
    } catch (error) {
      this.logger.debug(
        `Failed to get geolocation for IP ${ip}: ${error.message}`,
      );
    }

    return { country: 'Неизвестно', city: 'Неизвестно', isp: 'Неизвестно' };
  }

  /**
   * Парсит User-Agent
   */
  private parseUserAgent(userAgent: string): string {
    if (userAgent.includes('Chrome')) {
      const match = userAgent.match(/Chrome\/(\d+)/);
      return `Chrome ${match?.[1] || ''}`;
    }
    if (userAgent.includes('Firefox')) {
      const match = userAgent.match(/Firefox\/(\d+)/);
      return `Firefox ${match?.[1] || ''}`;
    }
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return 'Safari';
    }
    if (userAgent.includes('Edge')) {
      return 'Edge';
    }
    return userAgent.slice(0, 50);
  }

  /**
   * Очистить счётчик неудачных попыток
   */
  private async clearFailedAttempts(ip: string): Promise<void> {
    const attemptKey = `${FAILED_ATTEMPTS_PREFIX}${ip}`;
    if (await this.cacheService.has(attemptKey)) {
      await this.cacheService.delete(attemptKey);
      this.logger.debug(`Cleared failed attempts for IP ${ip}`);
    }
  }
}
