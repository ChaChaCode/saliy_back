import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { SimpleCacheService } from '../../common/cache/simple-cache.service';
import * as crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = '-1003644248789';
const LOGIN_REQUEST_TTL = 5 * 60 * 1000; // 5 минут

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private cacheService: SimpleCacheService,
  ) {}

  /**
   * Запросить вход через Telegram
   */
  async requestLogin(ip: string, userAgent: string) {
    const loginId = crypto.randomUUID();
    const verificationCode = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + LOGIN_REQUEST_TTL);

    // Сохраняем запрос в БД
    await this.prisma.adminLoginRequest.create({
      data: {
        loginId,
        verificationCode,
        ip,
        userAgent,
        expiresAt,
      },
    });

    // Отправляем сообщение в Telegram
    await this.sendLoginRequest(loginId, verificationCode, ip, userAgent);

    this.logger.log(`Login request created: ${loginId} for IP ${ip}`);

    return {
      loginId,
      expiresIn: 300, // 5 минут в секундах
      verificationCode,
    };
  }

  /**
   * Проверить статус входа (для polling)
   */
  async checkStatus(loginId: string) {
    const request = await this.prisma.adminLoginRequest.findUnique({
      where: { loginId },
    });

    if (!request || request.expiresAt < new Date()) {
      throw new UnauthorizedException('Запрос не найден или истёк');
    }

    if (request.approved && request.token) {
      return {
        approved: true,
        token: request.token,
      };
    }

    return { approved: false };
  }

  /**
   * Подтвердить вход через Telegram (автоматически создаёт админа если нужно)
   */
  async approveLoginByTelegram(
    loginId: string,
    telegramUserId: string,
    telegramUserName: string,
  ) {
    const request = await this.prisma.adminLoginRequest.findUnique({
      where: { loginId },
    });

    if (!request) {
      throw new UnauthorizedException('Запрос не найден');
    }

    if (request.expiresAt < new Date()) {
      throw new UnauthorizedException('Запрос истёк');
    }

    // Находим или создаём админа по Telegram ID
    let admin = await this.prisma.admin.findUnique({
      where: { telegramId: telegramUserId },
    });

    if (!admin) {
      // Создаём нового админа
      admin = await this.prisma.admin.create({
        data: {
          telegramId: telegramUserId,
          name: telegramUserName,
          role: 'SUPER_ADMIN', // Первый вход = SUPER_ADMIN
          isActive: true,
        },
      });

      this.logger.log(`New admin created: ${admin.name} (Telegram ID: ${telegramUserId})`);
    } else if (!admin.isActive) {
      throw new UnauthorizedException('Администратор деактивирован');
    }

    // Генерируем токен
    const token = this.jwtService.sign(
      {
        sub: admin.id,
        type: 'admin',
        name: admin.name,
        role: admin.role,
      },
      {
        secret: process.env.JWT_ADMIN_SECRET || 'admin-secret-key',
        expiresIn: '24h',
      },
    );

    // Обновляем запрос
    await this.prisma.adminLoginRequest.update({
      where: { loginId },
      data: {
        approved: true,
        token,
      },
    });

    this.logger.log(`Login approved: ${loginId} for admin ${admin.name}`);

    return { token };
  }

  /**
   * Отозвать токен
   */
  async revokeToken(token: string) {
    const revokedKey = `admin:revoked_token:${token}`;
    // Сохраняем на 24 часа (время жизни токена)
    await this.cacheService.set(revokedKey, true, 24 * 60 * 60 * 1000);
    this.logger.log('Token revoked');
  }

  /**
   * Refresh токена
   */
  async refreshToken(oldToken: string) {
    try {
      const payload = this.jwtService.verify(oldToken, {
        secret: process.env.JWT_ADMIN_SECRET || 'admin-secret-key',
      });

      // Проверяем, не отозван ли токен
      const revokedKey = `admin:revoked_token:${oldToken}`;
      if (await this.cacheService.has(revokedKey)) {
        throw new UnauthorizedException('Токен отозван');
      }

      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Администратор не найден или деактивирован');
      }

      // Генерируем новый токен
      const newToken = this.jwtService.sign(
        {
          sub: admin.id,
          type: 'admin',
          name: admin.name,
          role: admin.role,
        },
        {
          secret: process.env.JWT_ADMIN_SECRET || 'admin-secret-key',
          expiresIn: '24h',
        },
      );

      return {
        token: newToken,
        expiresIn: 86400, // 24 часа
      };
    } catch (error) {
      throw new UnauthorizedException('Недействительный токен');
    }
  }

  /**
   * Генерировать 4-символьный код
   */
  private generateVerificationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Отправить запрос входа в Telegram
   */
  private async sendLoginRequest(
    loginId: string,
    verificationCode: string,
    ip: string,
    userAgent: string,
  ) {
    if (!TELEGRAM_BOT_TOKEN) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set');
      return;
    }

    const geo = await this.getGeoLocation(ip);
    const browserInfo = this.parseUserAgent(userAgent);
    const now = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
    });

    const message = `
🔐 *Запрос входа в админку*

🔑 *Код:* \`${verificationCode}\`

📍 *IP:* \`${ip}\`
🌍 *Локация:* ${geo.city}, ${geo.country}
🏢 *Провайдер:* ${geo.isp}
🌐 *Браузер:* ${browserInfo}
🕐 *Время (МСК):* ${now}

⏱ Ссылка действительна 5 минут
    `.trim();

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHANNEL_ID,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Подтвердить',
                  callback_data: `admin_approve:${loginId}`,
                },
                {
                  text: '❌ Блок IP',
                  callback_data: `admin_block:${ip}`,
                },
              ],
            ],
          },
        }),
      });

      this.logger.log(`Login request sent to Telegram for ${ip}`);
    } catch (error) {
      this.logger.error(`Failed to send login request: ${error.message}`);
    }
  }

  /**
   * Получить геолокацию по IP
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
      this.logger.debug(`Failed to get geolocation: ${error.message}`);
    }

    return { country: 'Неизвестно', city: 'Неизвестно', isp: 'Неизвестно' };
  }

  /**
   * Парсит User-Agent
   */
  private parseUserAgent(userAgent: string): string {
    if (!userAgent) return 'Неизвестно';

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
}
