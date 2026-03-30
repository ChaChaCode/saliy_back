import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';

export interface PromoValidationResult {
  isValid: boolean;
  discount: number;
  message?: string;
  promoCode?: any;
  isFreeDelivery?: boolean;
  reason?: string;
}

@Injectable()
export class PromoService {
  private readonly logger = new Logger(PromoService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Находит активный и валидный промокод по коду
   */
  private async findActivePromoCode(code: string) {
    const normalizedCode = code.toUpperCase();
    const now = new Date();

    const promoCodes = await this.prisma.promoCode.findMany({
      where: { code: normalizedCode },
      orderBy: { createdAt: 'desc' },
    });

    if (promoCodes.length === 0) {
      return null;
    }

    // Ищем активный и не истёкший
    const activePromo = promoCodes.find((promo) => {
      if (!promo.isActive) return false;
      if (promo.validFrom && now < promo.validFrom) return false;
      if (promo.validUntil && now > promo.validUntil) return false;
      if (promo.maxUses && promo.usedCount >= promo.maxUses) return false;
      return true;
    });

    if (activePromo) {
      return { promoCode: activePromo, status: 'active' as const };
    }

    const latestPromo = promoCodes[0];

    if (!latestPromo.isActive) {
      return { promoCode: latestPromo, status: 'inactive' as const };
    }
    if (latestPromo.validFrom && now < latestPromo.validFrom) {
      return { promoCode: latestPromo, status: 'not_started' as const };
    }
    if (latestPromo.validUntil && now > latestPromo.validUntil) {
      return { promoCode: latestPromo, status: 'expired' as const };
    }
    if (latestPromo.maxUses && latestPromo.usedCount >= latestPromo.maxUses) {
      return { promoCode: latestPromo, status: 'exhausted' as const };
    }

    return { promoCode: latestPromo, status: 'inactive' as const };
  }

  /**
   * Валидация промокода
   */
  async validatePromoCode(
    dto: ValidatePromoDto,
    userId?: string,
  ): Promise<PromoValidationResult> {
    try {
      const result = await this.findActivePromoCode(dto.code);

      if (!result) {
        return {
          isValid: false,
          discount: 0,
          message: 'Промокод не найден',
        };
      }

      const { promoCode, status } = result;

      // Проверяем статус
      if (status === 'inactive') {
        return {
          isValid: false,
          discount: 0,
          message: 'Промокод не активен',
        };
      }

      if (status === 'not_started') {
        const startDate = promoCode.validFrom!.toLocaleDateString('ru-RU');
        return {
          isValid: false,
          discount: 0,
          message: `Промокод начнёт действовать ${startDate}`,
        };
      }

      if (status === 'expired') {
        return {
          isValid: false,
          discount: 0,
          message: 'Срок действия промокода истек',
        };
      }

      if (status === 'exhausted') {
        return {
          isValid: false,
          discount: 0,
          message: 'Промокод больше не действителен',
        };
      }

      // Проверка allowedUserIds
      if (
        promoCode.allowedUserIds &&
        promoCode.allowedUserIds.length > 0
      ) {
        if (!userId || !promoCode.allowedUserIds.includes(userId)) {
          return {
            isValid: false,
            discount: 0,
            message: 'Промокод недоступен для вас',
          };
        }
      }

      // Проверка лимита на пользователя
      if (promoCode.maxUsesPerUser && userId) {
        const userUsageCount = await this.prisma.promoCodeUsage.count({
          where: {
            promoCodeId: promoCode.id,
            userId,
          },
        });

        if (userUsageCount >= promoCode.maxUsesPerUser) {
          return {
            isValid: false,
            discount: 0,
            message: 'Вы уже использовали этот промокод максимальное количество раз',
          };
        }
      }

      // Проверка минимальной суммы заказа
      if (promoCode.minOrderAmount && dto.orderAmount) {
        if (dto.orderAmount < promoCode.minOrderAmount) {
          return {
            isValid: false,
            discount: 0,
            message: `Минимальная сумма заказа: ${promoCode.minOrderAmount} ₽`,
          };
        }
      }

      // Подгружаем данные товаров
      let cartItemsWithData: Array<{
        productId: number;
        quantity: number;
        price: number;
        cardStatus?: string | null;
        name?: string;
      }> = (dto.cartItems || []).map((item) => ({
        ...item,
        cardStatus: null,
        name: undefined,
      }));

      if (cartItemsWithData.length > 0) {
        const productIds = cartItemsWithData.map((item) => item.productId);
        if (productIds.length > 0) {
          const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, cardStatus: true, name: true },
          });
          const productDataMap = new Map(
            products.map((p) => [p.id, { cardStatus: p.cardStatus, name: p.name }]),
          );
          cartItemsWithData = cartItemsWithData.map((item) => ({
            ...item,
            cardStatus: productDataMap.get(item.productId)?.cardStatus || null,
            name: productDataMap.get(item.productId)?.name,
          }));
        }
      }

      // Проверка на новинки (если включена)
      if (promoCode.excludeNewItems) {
        const newItems = cartItemsWithData.filter(
          (item) => item.cardStatus === 'NEW',
        );
        const hasNewItems = newItems.length > 0;

        // FREE_DELIVERY всегда можно применить к новинкам
        if (hasNewItems && promoCode.type !== 'FREE_DELIVERY') {
          const newProductNames = newItems
            .map((i) => i.name || `#${i.productId}`)
            .join(', ');
          return {
            isValid: false,
            discount: 0,
            message: `Промокоды не применяются к заказам с новинками (${newProductNames})`,
            reason: 'NEW_ITEMS_IN_CART',
          };
        }
      }

      // Расчет применимой суммы
      const applicableAmount = this.calculateApplicableAmount(
        promoCode,
        cartItemsWithData,
      );

      if (applicableAmount === 0) {
        return {
          isValid: false,
          discount: 0,
          message: 'Промокод не применим к товарам в корзине',
        };
      }

      let discount = 0;
      let discountMessage = '';

      if (promoCode.type === 'FREE_DELIVERY') {
        return {
          isValid: true,
          discount: 0,
          isFreeDelivery: true,
          promoCode: {
            ...promoCode,
            isFreeDelivery: true,
          },
          message: 'Бесплатная доставка',
        };
      } else if (promoCode.type === 'PERCENTAGE') {
        discount = applicableAmount * (promoCode.value / 100);
        discountMessage = `${promoCode.value}%`;
      } else if (promoCode.type === 'FIXED') {
        discount = Math.min(promoCode.value, applicableAmount);
        discountMessage = `${promoCode.value} ₽`;
      }

      return {
        isValid: true,
        discount: Math.round(discount * 100) / 100,
        promoCode,
        message: `Скидка ${discountMessage}`,
      };
    } catch (error) {
      this.logger.error('Error validating promo code', {
        error: error.message,
        code: dto.code,
      });
      throw new BadRequestException('Ошибка проверки промокода');
    }
  }

  /**
   * Расчет применимой суммы
   */
  private calculateApplicableAmount(promoCode: any, cartItems: any[]): number {
    const applicableItems: Array<{ price: number }> = [];

    for (const item of cartItems) {
      // Проверяем исключения
      if (promoCode.excludedProductIds?.includes(item.productId)) {
        continue;
      }

      let isApplicable = false;

      switch (promoCode.appliesTo) {
        case 'ALL':
          isApplicable = true;
          break;

        case 'PRODUCT':
          isApplicable = promoCode.specificProductIds.includes(item.productId);
          break;
      }

      if (isApplicable) {
        // Добавляем каждую единицу товара отдельно
        for (let i = 0; i < item.quantity; i++) {
          applicableItems.push({ price: item.price });
        }
      }
    }

    // Если есть maxItems, берём только самые дорогие
    if (promoCode.maxItems && promoCode.maxItems > 0) {
      applicableItems.sort((a, b) => b.price - a.price);
      const limitedItems = applicableItems.slice(0, promoCode.maxItems);
      return limitedItems.reduce((sum, item) => sum + item.price, 0);
    }

    return applicableItems.reduce((sum, item) => sum + item.price, 0);
  }

  /**
   * Использовать промокод (увеличить счетчик)
   */
  async usePromoCode(
    promoCodeId: number,
    userId?: string,
    orderId?: string,
  ): Promise<void> {
    await this.prisma.promoCode.update({
      where: { id: promoCodeId },
      data: {
        usedCount: { increment: 1 },
      },
    });

    if (userId) {
      await this.prisma.promoCodeUsage.create({
        data: {
          promoCodeId,
          userId,
          orderId,
        },
      });
    }
  }
}
