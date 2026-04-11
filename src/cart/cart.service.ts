import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto, UpdateCartItemDto, CartItemDto } from './cart.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== CRUD ДЛЯ АВТОРИЗОВАННЫХ ====================

  /**
   * Получить корзину пользователя
   */
  async getCart(userId: string) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            categories: {
              include: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cartItems;
  }

  /**
   * Добавить товар в корзину
   */
  async addToCart(userId: string, dto: AddToCartDto) {
    const { productId, size, quantity } = dto;

    // Проверяем существование товара
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Товар с ID ${productId} не найден`);
    }

    if (!product.isActive) {
      throw new BadRequestException('Товар недоступен для заказа');
    }

    // Проверяем наличие на складе
    const stock = product.stock as any;
    const availableQuantity = stock[size] || 0;

    if (availableQuantity < quantity) {
      if (availableQuantity === 0) {
        throw new BadRequestException('Товар закончился');
      }
      throw new BadRequestException(
        `Доступно только ${availableQuantity} шт`,
      );
    }

    // Проверяем, есть ли уже такой товар в корзине
    const existing = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId_size: {
          userId,
          productId,
          size,
        },
      },
    });

    if (existing) {
      // Обновляем количество
      const newQuantity = existing.quantity + quantity;

      if (availableQuantity < newQuantity) {
        if (availableQuantity === 0) {
          throw new BadRequestException('Товар закончился');
        }
        throw new BadRequestException(
          `Доступно только ${availableQuantity} шт (в корзине уже ${existing.quantity})`,
        );
      }

      const updated = await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
        include: {
          product: true,
        },
      });

      this.logger.log(
        `Обновлено количество в корзине: пользователь ${userId}, товар ${productId}, размер ${size}, количество ${existing.quantity} -> ${newQuantity}`,
      );

      return updated;
    }

    // Создаем новый элемент корзины
    const cartItem = await this.prisma.cartItem.create({
      data: {
        userId,
        productId,
        size,
        quantity,
      },
      include: {
        product: true,
      },
    });

    this.logger.log(
      `Товар добавлен в корзину: пользователь ${userId}, товар ${productId} (${product.name}), размер ${size}, количество ${quantity}`,
    );

    return cartItem;
  }

  /**
   * Обновить количество товара в корзине
   */
  async updateCartItem(userId: string, itemId: number, dto: UpdateCartItemDto) {
    const { quantity } = dto;

    // Проверяем, принадлежит ли элемент корзины пользователю
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId,
      },
      include: {
        product: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Элемент корзины не найден');
    }

    // Проверяем наличие на складе
    const stock = cartItem.product.stock as any;
    const availableQuantity = stock[cartItem.size] || 0;

    if (availableQuantity < quantity) {
      if (availableQuantity === 0) {
        throw new BadRequestException('Товар закончился');
      }
      throw new BadRequestException(
        `Доступно только ${availableQuantity} шт`,
      );
    }

    // Обновляем количество
    const updated = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        product: true,
      },
    });

    this.logger.log(
      `Обновлено количество в корзине: пользователь ${userId}, товар ${cartItem.productId}, количество ${cartItem.quantity} -> ${quantity}`,
    );

    return updated;
  }

  /**
   * Удалить товар из корзины
   */
  async removeFromCart(userId: string, itemId: number) {
    // Проверяем, принадлежит ли элемент корзины пользователю
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Элемент корзины не найден');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    this.logger.log(
      `Товар удален из корзины: пользователь ${userId}, элемент ${itemId}`,
    );

    return { success: true, message: 'Товар удален из корзины' };
  }

  /**
   * Очистить всю корзину пользователя
   */
  async clearCart(userId: string) {
    const result = await this.prisma.cartItem.deleteMany({
      where: { userId },
    });

    this.logger.log(
      `Корзина очищена: пользователь ${userId}, удалено элементов: ${result.count}`,
    );

    return { success: true, message: 'Корзина очищена', deletedCount: result.count };
  }

  // ==================== ВАЛИДАЦИЯ КОРЗИНЫ ====================

  /**
   * Валидировать корзину (для гостей и авторизованных)
   * Возвращает актуальные цены, скидки и наличие
   */
  async validateCart(items: CartItemDto[]) {
    const validatedItems: any[] = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Товар с ID ${item.productId} не найден`,
        );
      }

      if (!product.isActive) {
        throw new BadRequestException(
          `Товар "${product.name}" недоступен для заказа`,
        );
      }

      // Проверяем наличие на складе
      const stock = product.stock as any;
      const availableQuantity = stock[item.size] || 0;
      const inStock = availableQuantity >= item.quantity;

      // Актуальная цена и скидка из БД
      const price = product.price;
      const discount = product.discount;
      const finalPrice = Math.floor(price - (price * discount) / 100);
      const totalPrice = finalPrice * item.quantity;

      subtotal += totalPrice;

      // Получаем превью изображение
      const images = product.images as any;
      const previewImage = images.find((img: any) => img.isPreview) || images[0];
      const imageUrl = previewImage?.url || '';

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        size: item.size,
        quantity: item.quantity,
        price,
        discount,
        finalPrice,
        totalPrice,
        inStock,
        availableQuantity,
        imageUrl,
      });
    }

    return {
      items: validatedItems,
      subtotal,
      total: subtotal, // Пока без промокода
      itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  // ==================== ОБЪЕДИНЕНИЕ КОРЗИНЫ ====================

  /**
   * Объединить корзину из localStorage с корзиной в БД при входе
   */
  async mergeCart(userId: string, items: CartItemDto[]) {
    let addedCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      try {
        // Пытаемся добавить (если товар уже есть, количество увеличится)
        const existing = await this.prisma.cartItem.findUnique({
          where: {
            userId_productId_size: {
              userId,
              productId: item.productId,
              size: item.size,
            },
          },
        });

        if (existing) {
          // Товар уже есть в БД - увеличиваем количество
          await this.prisma.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
            },
          });
          updatedCount++;
        } else {
          // Товара нет - создаем новый
          await this.prisma.cartItem.create({
            data: {
              userId,
              productId: item.productId,
              size: item.size,
              quantity: item.quantity,
            },
          });
          addedCount++;
        }
      } catch (error) {
        this.logger.warn(
          `Не удалось добавить товар ${item.productId} при объединении корзины: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Корзина объединена: пользователь ${userId}, добавлено ${addedCount}, обновлено ${updatedCount}`,
    );

    return {
      success: true,
      addedCount,
      updatedCount,
      message: 'Корзина объединена',
    };
  }
}
