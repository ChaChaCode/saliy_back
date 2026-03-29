import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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
