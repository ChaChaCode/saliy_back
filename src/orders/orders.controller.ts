import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './orders.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Получить доступные методы доставки и оплаты для страны
   * GET /api/orders/delivery-options?country=RU
   */
  @Get('delivery-options')
  async getDeliveryOptions(@Query('country') countryCode: string) {
    // Россия и Беларусь - только CDEK самовывоз
    // Другие страны - только стандартная почта
    const isRussiaBelarus = ['RU', 'BY', 'RUS', 'BLR'].includes(countryCode?.toUpperCase());

    const deliveryTypes = isRussiaBelarus
      ? ['CDEK_PICKUP']
      : ['STANDARD'];

    // Только Яндекс Пей (CARD_ONLINE) для всех стран
    const paymentMethods = ['CARD_ONLINE']; // Фейковая оплата, сразу проходит

    return {
      deliveryTypes,
      paymentMethods,
      country: countryCode,
    };
  }

  /**
   * Рассчитать стоимость заказа (БЕЗ создания заказа)
   * POST /api/orders/calculate
   * Показывает итоговую сумму перед кнопкой "Оплатить"
   */
  @Post('calculate')
  async calculateOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.calculateOrder(dto);
  }

  /**
   * Создать заказ
   * POST /api/orders
   * Доступно и гостям, и авторизованным
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async createOrder(@Req() req: any, @Body() dto: CreateOrderDto) {
    const userId = req.user?.id; // Если авторизован - привязываем к пользователю
    return this.ordersService.createOrder(dto, userId);
  }

  /**
   * Получить заказ по номеру
   * GET /api/orders/:orderNumber
   */
  @Get(':orderNumber')
  async getOrderByNumber(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.getOrderByNumber(orderNumber);
  }

  /**
   * Получить заказы пользователя
   * GET /api/orders
   * Только для авторизованных
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserOrders(@Req() req: any) {
    return this.ordersService.getUserOrders(req.user.id);
  }
}
