import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { NewsletterService } from '../../newsletter/newsletter.service';
import { S3StorageService } from '../../common/storage/s3-storage.service';

type CampaignTarget = 'ALL' | 'WITH_ORDERS' | 'WITHOUT_ORDERS' | 'NEWSLETTER';
type CampaignStatus = 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED';

interface CreateCampaignDto {
  subject: string;
  html: string;
  targetType?: CampaignTarget;
}

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

interface Recipient {
  email: string;
  unsubscribeToken?: string; // только для подписчиков рассылки
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly newsletterService: NewsletterService,
    private readonly s3: S3StorageService,
  ) {}

  async create(dto: CreateCampaignDto, createdBy?: string) {
    return this.prisma.emailCampaign.create({
      data: {
        subject: dto.subject,
        html: dto.html,
        targetType: dto.targetType || 'ALL',
        status: 'DRAFT',
        createdBy,
      },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      this.prisma.emailCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailCampaign.count(),
    ]);
    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.emailCampaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      throw new NotFoundException(`Рассылка ${id} не найдена`);
    }
    return campaign;
  }

  async remove(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status === 'SENDING') {
      throw new BadRequestException('Нельзя удалить активную рассылку');
    }
    await this.prisma.emailCampaign.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Запустить рассылку (работает в фоне, без await)
   */
  async startSending(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'FAILED') {
      throw new BadRequestException(
        `Рассылка в статусе ${campaign.status} — нельзя запустить`,
      );
    }

    const recipients = await this.getRecipients(
      campaign.targetType as CampaignTarget,
    );

    if (recipients.length === 0) {
      throw new BadRequestException('Нет получателей для рассылки');
    }

    // Помечаем как SENDING атомарно: повторный клик «Отправить» не запустит
    // вторую рассылку, пока первая идёт.
    const claimed = await this.prisma.emailCampaign.updateMany({
      where: { id, status: { in: ['DRAFT', 'FAILED'] } },
      data: {
        status: 'SENDING',
        totalCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        startedAt: new Date(),
        error: null,
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Рассылка уже запущена');
    }

    // Запускаем в фоне (не await — возвращаем сразу)
    this.processSending(id, campaign.subject, campaign.html, recipients).catch(
      async (error) => {
        this.logger.error(`Ошибка рассылки ${id}: ${error.message}`);
        await this.prisma.emailCampaign
          .update({
            where: { id },
            data: {
              status: 'FAILED',
              error: String(error.message).slice(0, 500),
            },
          })
          .catch(() => undefined);
      },
    );

    return {
      success: true,
      message: 'Рассылка запущена в фоне',
      totalRecipients: recipients.length,
    };
  }

  /**
   * Письмо подписчикам о товаре: создаёт кампанию NEWSLETTER и сразу запускает её.
   * Отправляется один раз на товар — отметка newsletterSentAt ставится атомарно,
   * поэтому повторный или параллельный запрос получит 409.
   */
  async notifyAboutProduct(productId: number, createdBy?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product || product.deletedAt) {
      throw new NotFoundException(`Товар ${productId} не найден`);
    }
    if (!product.isActive) {
      throw new BadRequestException(
        'Товар скрыт с витрины — опубликуйте его перед рассылкой',
      );
    }

    const claimed = await this.prisma.product.updateMany({
      where: { id: productId, newsletterSentAt: null },
      data: { newsletterSentAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new ConflictException(
        'Подписчикам уже отправлено письмо об этом товаре',
      );
    }

    try {
      const campaign = await this.create(
        {
          subject: `Новинка SALIY: ${product.name}`,
          html: this.buildProductHtml(product),
          targetType: 'NEWSLETTER',
        },
        createdBy,
      );
      const result = await this.startSending(campaign.id);
      return { ...result, campaignId: campaign.id };
    } catch (error) {
      // Не отправили (например, нет подписчиков) — разрешаем повторить позже.
      await this.prisma.product.update({
        where: { id: productId },
        data: { newsletterSentAt: null },
      });
      throw error;
    }
  }

  private buildProductHtml(product: {
    name: string;
    slug: string;
    description: string | null;
    price: number;
    discount: number;
    images: Prisma.JsonValue;
  }): string {
    const esc = (v: string) =>
      v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const frontend = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const url = `${frontend}/product/${encodeURIComponent(product.slug)}`;

    // В БД лежит JPEG/WebP-копия: AVIF почтовые клиенты не показывают.
    const images = Array.isArray(product.images)
      ? (product.images as { url?: string; previewOrder?: number }[])
      : [];
    const cover = [...images]
      .filter((i) => i?.url)
      .sort((a, b) => (a.previewOrder ?? 999) - (b.previewOrder ?? 999))[0];
    const imageUrl = cover?.url ? this.s3.keyToUrl(cover.url) : null;

    const finalPrice = Math.round(product.price * (1 - product.discount / 100));
    const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;
    const priceHtml =
      product.discount > 0
        ? `<span style="text-decoration: line-through; color: #888;">${rub(product.price)}</span> ${rub(finalPrice)}`
        : rub(product.price);
    const description = product.description
      ? `<p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #444;">${esc(product.description).slice(0, 400)}</p>`
      : '';

    return `
      <div style="max-width: 480px; margin: 0 auto; font-family: Arial, sans-serif; color: #121212; background: #ffffff;">
        <div style="text-align: center; padding: 24px 0; font-size: 18px; font-weight: bold; letter-spacing: 4px;">SALIY CLOTHES</div>
        ${imageUrl ? `<a href="${esc(url)}"><img src="${esc(imageUrl)}" alt="${esc(product.name)}" width="480" style="display: block; width: 100%; height: auto; border: 0;" /></a>` : ''}
        <div style="padding: 24px 16px; text-align: center;">
          <div style="font-size: 12px; letter-spacing: 2px; color: #888; text-transform: uppercase;">Новинка</div>
          <h1 style="margin: 8px 0 12px; font-size: 22px; font-weight: 600; text-transform: uppercase;">${esc(product.name)}</h1>
          <div style="margin: 0 0 20px; font-size: 18px;">${priceHtml}</div>
          ${description}
          <a href="${esc(url)}" style="display: inline-block; background: #000000; color: #ffffff; padding: 14px 32px; text-decoration: none; font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">Смотреть</a>
        </div>
      </div>
    `;
  }

  /**
   * Получить список получателей по типу аудитории.
   * Для NEWSLETTER возвращаются только активные подписчики с unsubscribe-токеном.
   * Для ALL/WITH_ORDERS/WITHOUT_ORDERS — зарегистрированные пользователи.
   */
  private async getRecipients(target: CampaignTarget): Promise<Recipient[]> {
    if (target === 'NEWSLETTER') {
      const subs = await this.newsletterService.getActiveSubscriberEmails();
      return subs.map((s) => ({
        email: s.email,
        unsubscribeToken: s.unsubscribeToken,
      }));
    }

    let where: Prisma.UserWhereInput = {};
    if (target === 'WITH_ORDERS') {
      where = { orders: { some: {} } };
    } else if (target === 'WITHOUT_ORDERS') {
      where = { orders: { none: {} } };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { email: true },
    });

    // Дедупликация по email
    const seen = new Set<string>();
    const recipients: Recipient[] = [];
    for (const u of users) {
      if (!u.email || seen.has(u.email)) continue;
      seen.add(u.email);
      recipients.push({ email: u.email });
    }
    return recipients;
  }

  /**
   * Добавить unsubscribe-футер к HTML-шаблону, если у получателя есть токен.
   */
  private buildHtmlForRecipient(html: string, recipient: Recipient): string {
    if (!recipient.unsubscribeToken) {
      return html;
    }
    const baseUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
    const unsubscribeUrl = `${baseUrl}/newsletter/unsubscribe/${recipient.unsubscribeToken}`;
    const footer = `
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
      <p style="font-size: 12px; color: #888; text-align: center; margin-top: 16px;">
        Вы получили это письмо, потому что подписаны на рассылку SALIY.
        <br/>
        <a href="${unsubscribeUrl}" style="color: #888; text-decoration: underline;">Отписаться</a>
      </p>
    `;
    return `${html}${footer}`;
  }

  /**
   * Фоновый процесс отправки батчами
   */
  private async processSending(
    id: string,
    subject: string,
    html: string,
    recipients: Recipient[],
  ) {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((r) =>
          this.emailService.sendRaw(
            r.email,
            subject,
            this.buildHtmlForRecipient(html, r),
          ),
        ),
      );

      // sendRaw не бросает ошибку SMTP, а возвращает false — это тоже неудача.
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          sent++;
        } else {
          failed++;
          if (result.status === 'rejected')
            this.logger.warn(`Не удалось отправить: ${result.reason}`);
        }
      }

      // Обновляем прогресс каждый батч
      await this.prisma.emailCampaign.update({
        where: { id },
        data: { sentCount: sent, failedCount: failed },
      });

      // Задержка между батчами (чтобы не забанили по rate limit)
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Финал
    await this.prisma.emailCampaign.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        sentCount: sent,
        failedCount: failed,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Рассылка ${id} завершена: отправлено=${sent}, ошибок=${failed}`,
    );
  }
}
