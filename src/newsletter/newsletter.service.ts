import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface SubscribeInput {
  email: string;
  acceptedTerms: boolean;
  source?: string;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Публичная подписка по email. Идемпотентно:
   *   — если такого email ещё не было → создаёт активную подписку
   *   — если был и активен → ничего не меняет, отдаёт «уже подписаны»
   *   — если был и отписан → реактивирует
   */
  async subscribe(input: SubscribeInput) {
    if (!input.acceptedTerms) {
      throw new BadRequestException(
        'Нужно согласиться с офертой и политикой конфиденциальности',
      );
    }

    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email обязателен');
    }

    // Привязываем к существующему юзеру, если есть
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.isActive) {
        return {
          alreadySubscribed: true,
          message: 'Вы уже подписаны',
        };
      }
      // Реактивация
      const reactivated = await this.prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          acceptedTerms: true,
          source: input.source ?? existing.source,
          unsubscribedAt: null,
          userId: user?.id ?? existing.userId,
        },
      });
      this.logger.log(`Подписка реактивирована: ${email}`);
      return {
        alreadySubscribed: false,
        message: 'Подписка восстановлена',
        subscriber: reactivated,
      };
    }

    const created = await this.prisma.newsletterSubscriber.create({
      data: {
        email,
        acceptedTerms: true,
        source: input.source ?? null,
        unsubscribeToken: randomBytes(24).toString('hex'),
        userId: user?.id ?? null,
      },
    });
    this.logger.log(`Новый подписчик: ${email} (источник: ${input.source ?? '—'})`);
    return {
      alreadySubscribed: false,
      message: 'Спасибо за подписку',
      subscriber: created,
    };
  }

  /**
   * Отписаться по токену из письма (one-click).
   * Идемпотентно: если уже отписан, тоже OK.
   */
  async unsubscribeByToken(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });
    if (!subscriber) {
      throw new NotFoundException('Подписка не найдена');
    }

    if (!subscriber.isActive) {
      return { success: true, message: 'Вы уже отписаны' };
    }

    await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false, unsubscribedAt: new Date() },
    });

    this.logger.log(`Отписался: ${subscriber.email}`);
    return { success: true, message: 'Вы отписались от рассылки' };
  }

  /**
   * Админ: список с фильтрами.
   */
  async findAllAdmin(params: {
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { isActive, search, page = 1, limit = 50 } = params;

    const where: Prisma.NewsletterSubscriberWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    const skip = (page - 1) * limit;
    const [subscribers, total] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.newsletterSubscriber.count({ where }),
    ]);

    return {
      subscribers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Админ: статистика.
   */
  async getStats() {
    const [total, active] = await Promise.all([
      this.prisma.newsletterSubscriber.count(),
      this.prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    ]);
    return { total, active, unsubscribed: total - active };
  }

  /**
   * Админ: удалить полностью (физически).
   */
  async deleteSubscriber(id: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Подписчик не найден');
    }
    await this.prisma.newsletterSubscriber.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Получить активных подписчиков для рассылки (используется CampaignsService).
   */
  async getActiveSubscriberEmails(): Promise<
    Array<{ email: string; unsubscribeToken: string }>
  > {
    return this.prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true, unsubscribeToken: true },
    });
  }
}
