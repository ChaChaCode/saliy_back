import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateAdminDto {
  telegramId: string;
  name: string;
  role?: AdminRole;
}

interface UpdateAdminDto {
  name?: string;
  role?: AdminRole;
  isActive?: boolean;
}

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException(`Админ ${id} не найден`);
    }
    return admin;
  }

  async create(dto: CreateAdminDto) {
    const existing = await this.prisma.admin.findUnique({
      where: { telegramId: dto.telegramId },
    });
    if (existing) {
      throw new BadRequestException(
        `Админ с Telegram ID ${dto.telegramId} уже существует`,
      );
    }

    const admin = await this.prisma.admin.create({
      data: {
        telegramId: dto.telegramId,
        name: dto.name,
        role: dto.role || AdminRole.ADMIN,
      },
    });

    this.logger.log(`Создан админ: ${admin.id} (${admin.name})`);
    return admin;
  }

  async update(id: string, dto: UpdateAdminDto) {
    await this.findOne(id);

    const admin = await this.prisma.admin.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Обновлён админ: ${id}`);
    return admin;
  }

  async remove(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('Нельзя удалить себя');
    }

    await this.findOne(id);
    await this.prisma.admin.delete({ where: { id } });

    this.logger.warn(`Удалён админ: ${id}`);
    return { success: true };
  }
}
