import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  ValidatePromoCodeDto,
} from './dto/promo-code.dto';

@Injectable()
export class PromoCodesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Проверяет, можно ли создать промокод с указанным кодом
   */
  private async checkCodeAvailability(
    code: string,
    excludeId?: number,
  ): Promise<{
    canCreate: boolean;
    activePromo: any | null;
    message: string | null;
  }> {
    const normalizedCode = code.toUpperCase();
    const now = new Date();

    const existingPromos = await this.prisma.promoCode.findMany({
      where: {
        code: normalizedCode,
        ...(excludeId && { id: { not: excludeId } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPromos.length === 0) {
      return { canCreate: true, activePromo: null, message: null };
    }

    // Проверяем, есть ли активный и не истёкший промокод
    const activePromo = existingPromos.find((promo) => {
      if (!promo.isActive) return false;
      if (promo.validUntil && promo.validUntil < now) return false;
      if (promo.maxUses && promo.usedCount >= promo.maxUses) return false;
      return true;
    });

    if (activePromo) {
      let message = `Промокод "${normalizedCode}" уже существует и активен`;
      if (activePromo.validUntil) {
        message += ` (до ${activePromo.validUntil.toLocaleDateString('ru-RU')})`;
      }
      if (activePromo.maxUses) {
        message += `. Использований: ${activePromo.usedCount}/${activePromo.maxUses}`;
      }
      message += `. Деактивируйте его (ID: ${activePromo.id}).`;

      return { canCreate: false, activePromo, message };
    }

    return { canCreate: true, activePromo: null, message: null };
  }

  /**
   * Создать промокод
   */
  async create(dto: CreatePromoCodeDto) {
    const availability = await this.checkCodeAvailability(dto.code);

    if (!availability.canCreate) {
      throw new BadRequestException(availability.message);
    }

    const description = this.generateDescription(dto);

    const promoCode = await this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value,
        appliesTo: dto.appliesTo || 'ALL',
        specificProductIds: dto.specificProductIds || [],
        excludedProductIds: dto.excludedProductIds || [],
        allowedUserIds: dto.allowedUserIds || [],
        requiresAuth: dto.requiresAuth ?? false,
        maxUses: dto.maxUses,
        maxUsesPerUser: dto.maxUsesPerUser,
        maxItems: dto.maxItems,
        minOrderAmount: dto.minOrderAmount,
        excludeNewItems: dto.excludeNewItems ?? true,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        isActive: dto.isActive ?? true,
        description,
      },
    });

    return { promoCode, description };
  }

  /**
   * Получить все промокоды с фильтрами
   */
  async findAll(options?: {
    isActive?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const { isActive, type, page = 1, limit = 50 } = options || {};

    const where: any = {};
    const now = new Date();

    if (isActive === true) {
      where.isActive = true;
      where.OR = [{ validUntil: null }, { validUntil: { gte: now } }];
    } else if (isActive === false) {
      where.OR = [{ isActive: false }, { validUntil: { lt: now } }];
    }

    if (type) where.type = type;

    const [promoCodes, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.promoCode.count({ where }),
    ]);

    return {
      promoCodes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Получить промокод по ID
   */
  async findOne(id: number) {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id },
      include: {
        usages: {
          take: 10,
          orderBy: { usedAt: 'desc' },
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!promoCode) {
      throw new NotFoundException(`Промокод с ID ${id} не найден`);
    }

    return promoCode;
  }

  /**
   * Обновить промокод
   */
  async update(id: number, dto: UpdatePromoCodeDto) {
    const existing = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Промокод с ID ${id} не найден`);
    }

    if (dto.code && dto.code.toUpperCase() !== existing.code) {
      const availability = await this.checkCodeAvailability(dto.code, id);
      if (!availability.canCreate) {
        throw new BadRequestException(availability.message);
      }
    }

    const mergedData: any = {
      type: dto.type || existing.type,
      value: dto.value ?? existing.value,
      appliesTo: dto.appliesTo || existing.appliesTo,
      minOrderAmount: dto.minOrderAmount ?? existing.minOrderAmount,
      specificProductIds: dto.specificProductIds ?? existing.specificProductIds,
      excludedProductIds: dto.excludedProductIds ?? existing.excludedProductIds,
      requiresAuth: dto.requiresAuth ?? existing.requiresAuth,
      allowedUserIds: dto.allowedUserIds ?? existing.allowedUserIds,
    };

    const description = this.generateDescription(mergedData);

    const promoCode = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.appliesTo && { appliesTo: dto.appliesTo }),
        ...(dto.specificProductIds && {
          specificProductIds: dto.specificProductIds,
        }),
        ...(dto.excludedProductIds && {
          excludedProductIds: dto.excludedProductIds,
        }),
        ...(dto.allowedUserIds !== undefined && {
          allowedUserIds: dto.allowedUserIds,
        }),
        ...(dto.requiresAuth !== undefined && {
          requiresAuth: dto.requiresAuth,
        }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.maxUsesPerUser !== undefined && {
          maxUsesPerUser: dto.maxUsesPerUser,
        }),
        ...(dto.maxItems !== undefined && { maxItems: dto.maxItems }),
        ...(dto.minOrderAmount !== undefined && {
          minOrderAmount: dto.minOrderAmount,
        }),
        ...(dto.excludeNewItems !== undefined && {
          excludeNewItems: dto.excludeNewItems,
        }),
        ...(dto.validFrom !== undefined && {
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        }),
        ...(dto.validUntil !== undefined && {
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        description,
      },
    });

    return { promoCode, description };
  }

  /**
   * Удалить промокод
   */
  async remove(id: number) {
    const existing = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Промокод с ID ${id} не найден`);
    }

    await this.prisma.promoCode.delete({ where: { id } });

    return { message: `Промокод ${existing.code} удалён` };
  }

  /**
   * Деактивировать промокод
   */
  async deactivate(id: number) {
    const existing = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Промокод с ID ${id} не найден`);
    }

    const promoCode = await this.prisma.promoCode.update({
      where: { id },
      data: { isActive: false },
    });

    return promoCode;
  }

  /**
   * Генерация описания промокода
   */
  private generateDescription(data: {
    type: string;
    value: number;
    appliesTo?: string;
    minOrderAmount?: number;
    specificProductIds?: number[];
    excludedProductIds?: number[];
    requiresAuth?: boolean;
    allowedUserIds?: string[];
  }): string {
    const parts: string[] = [];

    if (data.type === 'FIXED') {
      parts.push(`Скидка ${data.value} ₽`);
    } else if (data.type === 'FREE_DELIVERY') {
      parts.push('Бесплатная доставка');
    } else {
      parts.push(`Скидка ${data.value}%`);
    }

    if (data.appliesTo === 'PRODUCT' && data.specificProductIds?.length) {
      parts.push(`для ${data.specificProductIds.length} товаров`);
    } else if (data.type !== 'FREE_DELIVERY') {
      parts[0] += ' на всё';
    }

    if (data.excludedProductIds?.length) {
      parts.push(`(есть исключения)`);
    }

    if (data.minOrderAmount) {
      parts.push(`при заказе от ${data.minOrderAmount} ₽`);
    }

    // Добавляем информацию об ограничениях по пользователям
    if (data.allowedUserIds && data.allowedUserIds.length > 0) {
      parts.push(`(персональный для ${data.allowedUserIds.length} польз.)`);
    } else if (data.requiresAuth) {
      parts.push(`(только для зарегистрированных)`);
    }

    return parts.join('. ');
  }

  /**
   * Получить статистику использований
   */
  async getUsageStats(promoCodeId: number) {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id: promoCodeId },
    });

    if (!promoCode) {
      throw new NotFoundException(`Промокод с ID ${promoCodeId} не найден`);
    }

    const usages = await this.prisma.promoCodeUsage.findMany({
      where: { promoCodeId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { usedAt: 'desc' },
    });

    // Группируем по пользователям
    const userUsageMap = new Map<string, { user: any; usageCount: number }>();

    for (const usage of usages) {
      if (!usage.userId) continue;

      const existing = userUsageMap.get(usage.userId);
      if (existing) {
        existing.usageCount++;
      } else {
        userUsageMap.set(usage.userId, {
          user: usage.user,
          usageCount: 1,
        });
      }
    }

    return {
      promoCodeId,
      code: promoCode.code,
      maxUses: promoCode.maxUses,
      maxUsesPerUser: promoCode.maxUsesPerUser,
      totalUsedCount: promoCode.usedCount,
      userStats: Array.from(userUsageMap.values()),
    };
  }
}
