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
import { YandexPayService } from '../payment/yandex-pay.service';
import { CreateOrderDto } from './orders.dto';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { OptionalCustomerAuthGuard } from '../auth/guards/optional-customer-auth.guard';
import { deliveryTypesFor } from '../delivery/cdek-countries';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly yandexPayService: YandexPayService,
  ) {}

  /**
   * Получить доступные методы доставки и оплаты для страны
   * GET /api/orders/delivery-options?country=RU
   */
  @Get('delivery-options')
  async getDeliveryOptions(@Query('country') countryCode: string) {
    // Почтовая доставка (STANDARD) доступна для любой страны.
    // В странах СДЭК (RU, BY, KZ — см. cdek-countries.ts) ещё и самовывоз из ПВЗ.
    const deliveryTypes = deliveryTypesFor(countryCode);

    // Т-Банк всегда; Яндекс Пэй — только когда заданы мерчант и ключ.
    const paymentMethods = [
      'CARD_ONLINE',
      ...(this.yandexPayService.isConfigured() ? ['YANDEX_PAY'] : []),
    ];

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
  @UseGuards(OptionalCustomerAuthGuard)
  async createOrder(@Req() req: any, @Body() dto: CreateOrderDto) {
    const userId = req.user?.id; // Если авторизован - привязываем к пользователю
    return this.ordersService.createOrder(dto, userId);
  }

  /**
   * Получить заказ по номеру
   * GET /api/orders/:orderNumber
   *
   * Доступно и гостям (страница «спасибо за заказ»), НО персональные данные
   * (ФИО, телефон, email, адрес) отдаются только владельцу заказа —
   * авторизованному пользователю, чей userId или email совпадает с заказом.
   * Иначе перебором предсказуемых номеров заказа сливались бы ПДн всех клиентов.
   */
  @Get(':orderNumber')
  @UseGuards(OptionalCustomerAuthGuard)
  async getOrderByNumber(
    @Param('orderNumber') orderNumber: string,
    @Req() req: any,
  ) {
    return this.ordersService.getOrderByNumber(
      orderNumber,
      req.user?.id,
      req.user?.email,
    );
  }

  /**
   * Получить заказы пользователя
   * GET /api/orders
   * Только для авторизованных
   */
  @Get()
  @UseGuards(CustomerAuthGuard)
  async getUserOrders(@Req() req: any) {
    return this.ordersService.getUserOrders(req.user.id, req.user.email);
  }
}
