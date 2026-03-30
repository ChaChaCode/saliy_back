import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import {
  CartItem,
  ValidatedCart,
  ValidateCartInput,
  CartItemInput,
} from './models/cart.model';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

@Resolver(() => CartItem)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  // ==================== ДЛЯ АВТОРИЗОВАННЫХ ====================

  /**
   * Получить корзину текущего пользователя
   */
  @Query(() => [CartItem], { name: 'cart' })
  @UseGuards(GqlAuthGuard)
  async getCart(@Context() context: any) {
    const userId = context.req.user.id;
    return this.cartService.getCart(userId);
  }

  /**
   * Добавить товар в корзину
   */
  @Mutation(() => CartItem)
  @UseGuards(GqlAuthGuard)
  async addToCart(
    @Context() context: any,
    @Args('productId', { type: () => Int }) productId: number,
    @Args('size') size: string,
    @Args('quantity', { type: () => Int }) quantity: number,
  ) {
    const userId = context.req.user.id;
    return this.cartService.addToCart(userId, { productId, size, quantity });
  }

  /**
   * Обновить количество товара
   */
  @Mutation(() => CartItem)
  @UseGuards(GqlAuthGuard)
  async updateCartItem(
    @Context() context: any,
    @Args('itemId', { type: () => Int }) itemId: number,
    @Args('quantity', { type: () => Int }) quantity: number,
  ) {
    const userId = context.req.user.id;
    return this.cartService.updateCartItem(userId, itemId, { quantity });
  }

  /**
   * Удалить товар из корзины
   */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async removeFromCart(
    @Context() context: any,
    @Args('itemId', { type: () => Int }) itemId: number,
  ) {
    const userId = context.req.user.id;
    const result = await this.cartService.removeFromCart(userId, itemId);
    return result.success;
  }

  /**
   * Очистить корзину
   */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async clearCart(@Context() context: any) {
    const userId = context.req.user.id;
    const result = await this.cartService.clearCart(userId);
    return result.success;
  }

  // ==================== ДЛЯ ВСЕХ (ГОСТИ + АВТОРИЗОВАННЫЕ) ====================

  /**
   * Валидировать корзину (получить актуальные цены и наличие)
   */
  @Query(() => ValidatedCart, { name: 'validateCart' })
  async validateCart(
    @Args({ name: 'items', type: () => [CartItemInput] })
    items: CartItemInput[],
  ) {
    return this.cartService.validateCart(items);
  }

  // ==================== ОБЪЕДИНЕНИЕ ====================

  /**
   * Объединить корзину из localStorage с корзиной в БД
   */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async mergeCart(
    @Context() context: any,
    @Args({ name: 'items', type: () => [CartItemInput] })
    items: CartItemInput[],
  ) {
    const userId = context.req.user.id;
    const result = await this.cartService.mergeCart(userId, items);
    return result.success;
  }
}
