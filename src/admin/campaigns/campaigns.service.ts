import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';

type CampaignTarget = 'ALL' | 'WITH_ORDERS' | 'WITHOUT_ORDERS';
type CampaignStatus = 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED';

interface CreateCampaignDto {
  subject: string;
  html: string;
  targetType?: CampaignTarget;
}

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1000;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
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

    // Помечаем как SENDING
    await this.prisma.emailCampaign.update({
      where: { id },
      data: {
        status: 'SENDING',
        totalCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        startedAt: new Date(),
        error: null,
      },
    });

    // Запускаем в фоне (не await — возвращаем сразу)
    this.processSending(id, campaign.subject, campaign.html, recipients).catch(
      (error) => {
        this.logger.error(`Ошибка рассылки ${id}: ${error.message}`);
      },
    );

    return {
      success: true,
      message: 'Рассылка запущена в фоне',
      totalRecipients: recipients.length,
    };
  }

  /**
   * Получить список email'ов по типу аудитории
   */
  private async getRecipients(target: CampaignTarget): Promise<string[]> {
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

    // Дедупликация
    return [...new Set(users.map((u) => u.email).filter(Boolean))];
  }

  /**
   * Фоновый процесс отправки батчами
   */
  private async processSending(
    id: string,
    subject: string,
    html: string,
    recipients: string[],
  ) {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((email) => this.emailService.sendRaw(email, subject, html)),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
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
