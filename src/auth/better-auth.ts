import { Logger } from '@nestjs/common';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP } from 'better-auth/plugins';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../common/email/email.service';
import { getBetterAuthSecret } from '../common/utils/jwt-secrets';
import { getCookieSameSite } from '../common/utils/cookie.util';

/** Маршруты Better Auth. Под /api/auth живут наши me, profile, avatar. */
export const BETTER_AUTH_BASE_PATH = '/api/session';

const SESSION_DAYS = 7;

const logger = new Logger('BetterAuth');

const trustedOrigins = () =>
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/** Публичный адрес сайта без /api: Better Auth сам добавляет basePath. */
const baseURL = () =>
  (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

/**
 * Привязать гостевые заказы на эту почту к покупателю: почта подтверждена
 * кодом, поэтому привязка безопасна. Ошибка не мешает входу.
 */
async function linkGuestOrders(prisma: PrismaService, userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return;
    const linked = await prisma.order.updateMany({
      where: { email: user.email, userId: null },
      data: { userId },
    });
    if (linked.count > 0) {
      logger.log(
        `Привязано гостевых заказов к пользователю ${userId}: ${linked.count}`,
      );
    }
  } catch (error: any) {
    logger.error(
      `Не удалось привязать гостевые заказы для ${userId}: ${error.message}`,
    );
  }
}

export function createBetterAuth(
  prisma: PrismaService,
  emailService: EmailService,
  // Хранилище подменяется только в проверочных сценариях; в приложении — Prisma.
  database: BetterAuthOptions['database'] = prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
) {
  return betterAuth({
    appName: 'SALIY',
    baseURL: baseURL(),
    basePath: BETTER_AUTH_BASE_PATH,
    secret: getBetterAuthSecret(),
    trustedOrigins: trustedOrigins(),
    database,

    user: {
      fields: { image: 'avatarUrl' },
    },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: 24 * 60 * 60, // продлевается раз в сутки при активности
    },

    // Входа по паролю нет — только код из письма.
    emailAndPassword: { enabled: false },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        // Отправка кода: не больше 3 писем в минуту с одного IP.
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 10 },
      },
    },

    advanced: {
      cookiePrefix: 'saliy',
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: getCookieSameSite(),
      },
      // nginx ставит X-Real-IP из адреса подключения; X-Forwarded-For клиент
      // может подделать и обойти ограничение частоты.
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
      database: { generateId: 'uuid' },
    },

    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await linkGuestOrders(prisma, session.userId);
          },
        },
      },
    },

    plugins: [
      emailOTP({
        // Те же правила, что у прежнего входа: 4 цифры, 10 минут, 10 попыток.
        otpLength: 4,
        expiresIn: 10 * 60,
        allowedAttempts: 10,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') return;
          await emailService.sendVerificationCode(email, otp);
        },
      }),
    ],
  });
}

export type BetterAuth = ReturnType<typeof createBetterAuth>;
