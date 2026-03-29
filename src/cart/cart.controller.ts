import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  ValidateCartDto,
  MergeCartDto,
} from './cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // ==================== ДЛЯ АВТОРИЗОВАННЫХ ====================

  /**
   * Получить корзину текущего пользователя
   * GET /api/cart
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  /**
   * Добавить товар в корзину
   * POST /api/cart/items
   */
  @Post('items')
  @UseGuards(JwtAuthGuard)
  async addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, dto);
  }

  /**
   * Обновить количество товара
   * PATCH /api/cart/items/:id
   */
  @Patch('items/:id')
  @UseGuards(JwtAuthGuard)
  async updateCartItem(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(req.user.id, id, dto);
  }

  /**
   * Удалить товар из корзины
   * DELETE /api/cart/items/:id
   */
  @Delete('items/:id')
  @UseGuards(JwtAuthGuard)
  async removeFromCart(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cartService.removeFromCart(req.user.id, id);
  }

  /**
   * Очистить корзину
   * DELETE /api/cart
   */
  @Delete()
  @UseGuards(JwtAuthGuard)
  async clearCart(@Req() req: any) {
    return this.cartService.clearCart(req.user.id);
  }

  // ==================== ДЛЯ ВСЕХ (ГОСТИ + АВТОРИЗОВАННЫЕ) ====================

  /**
   * Валидировать корзину (получить актуальные цены и наличие)
   * POST /api/cart/validate
   * Может использоваться и гостями, и авторизованными
   */
  @Post('validate')
  async validateCart(@Body() dto: ValidateCartDto) {
    return this.cartService.validateCart(dto.items);
  }

  // ==================== ОБЪЕДИНЕНИЕ ====================

  /**
   * Объединить корзину из localStorage с корзиной в БД
   * POST /api/cart/merge
   * Используется при входе пользователя
   */
  @Post('merge')
  @UseGuards(JwtAuthGuard)
  async mergeCart(@Req() req: any, @Body() dto: MergeCartDto) {
    return this.cartService.mergeCart(req.user.id, dto.items);
  }
}
