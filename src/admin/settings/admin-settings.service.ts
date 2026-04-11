import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Получить все настройки
   */
  async findAll() {
    const settings = await this.prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      key: s.key,
      value: this.parseValue(s.value),
      description: s.description,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Получить настройку по ключу
   */
  async findOne(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Настройка "${key}" не найдена`);
    }
    return {
      key: setting.key,
      value: this.parseValue(setting.value),
      description: setting.description,
      updatedAt: setting.updatedAt,
    };
  }

  /**
   * Получить значение напрямую (для использования другими сервисами)
   */
  async getValue<T = any>(key: string, defaultValue: T): Promise<T> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) return defaultValue;
    try {
      return this.parseValue(setting.value) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Создать или обновить настройку
   */
  async upsert(key: string, value: any, description?: string) {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    const setting = await this.prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: stringValue,
        description,
      },
      update: {
        value: stringValue,
        ...(description !== undefined && { description }),
      },
    });

    this.logger.log(`Настройка обновлена: ${key} = ${stringValue}`);

    return {
      key: setting.key,
      value: this.parseValue(setting.value),
      description: setting.description,
      updatedAt: setting.updatedAt,
    };
  }

  /**
   * Удалить настройку
   */
  async remove(key: string) {
    try {
      await this.prisma.setting.delete({ where: { key } });
      return { success: true };
    } catch {
      throw new NotFoundException(`Настройка "${key}" не найдена`);
    }
  }

  private parseValue(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      const num = Number(raw);
      if (!isNaN(num) && raw.trim() !== '') return num;
      return raw;
    }
  }
}
