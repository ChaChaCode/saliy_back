import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrderStatus } from '@prisma/client';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { AdminOrdersService } from './admin-orders.service';
import {
  UpdateOrderStatusDto,
  CancelOrderDto,
  UpdateOrderDto,
} from './dto/update-order.dto';
import { AdminGuard } from '../../common/guards/admin.guard';

class UpdateCdekDto {
  @IsOptional() @IsString() cdekNumber?: string;
  @IsOptional() @IsString() cdekUuid?: string;
  @IsOptional() @IsString() cdekStatus?: string;
  @IsOptional() @IsString() cdekStatusName?: string;
}

class RefundOrderDto {
  @IsString() @IsNotEmpty() reason: string;
}

class SendEmailDto {
  @IsString() @IsNotEmpty() subject: string;
  @IsString() @IsNotEmpty() message: string;
}

@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  /**
   * Статистика заказов
   * GET /api/admin/orders/stats
   */
  @Get('stats')
  getStats() {
    return this.adminOrdersService.getStats();
  }

  /**
   * Экспорт заказов в CSV
   * GET /api/admin/orders/export.csv
   */
  @Get('export.csv')
  async exportCsv(
    @Res() res: Response,
    @Query('status') status?: OrderStatus,
    @Query('isPaid') isPaid?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const csv = await this.adminOrdersService.exportToCsv({
      status,
      isPaid:
        isPaid === 'true' ? true : isPaid === 'false' ? false : undefined,
      search,
      dateFrom,
      dateTo,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  /**
   * Список всех заказов с фильтрами
   * GET /api/admin/orders
   */
  @Get()
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('isPaid') isPaid?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminOrdersService.findAll({
      status,
      isPaid:
        isPaid === 'true' ? true : isPaid === 'false' ? false : undefined,
      search,
      dateFrom,
      dateTo,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Получить заказ по номеру
   * GET /api/admin/orders/:orderNumber
   */
  @Get(':orderNumber')
  findOne(@Param('orderNumber') orderNumber: string) {
    return this.adminOrdersService.findByNumber(orderNumber);
  }

  /**
   * Обновить произвольные поля заказа (клиент, адрес, доставка, комментарий)
   * PATCH /api/admin/orders/:orderNumber
   */
  @Patch(':orderNumber')
  updateOrder(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.adminOrdersService.updateOrder(orderNumber, dto as any);
  }

  /**
   * Изменить статус заказа
   * PATCH /api/admin/orders/:orderNumber/status
   */
  @Patch(':orderNumber/status')
  updateStatus(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminOrdersService.updateStatus(orderNumber, dto.status);
  }

  /**
   * Отменить заказ (возврат остатков на склад)
   * POST /api/admin/orders/:orderNumber/cancel
   */
  @Post(':orderNumber/cancel')
  cancel(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.adminOrdersService.cancelOrder(orderNumber, dto.reason);
  }

  /**
   * Оформить возврат
   * POST /api/admin/orders/:orderNumber/refund
   */
  @Post(':orderNumber/refund')
  refund(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: RefundOrderDto,
  ) {
    return this.adminOrdersService.refundOrder(orderNumber, dto.reason);
  }

  /**
   * Обновить CDEK-информацию заказа
   * PATCH /api/admin/orders/:orderNumber/cdek
   */
  @Patch(':orderNumber/cdek')
  updateCdek(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: UpdateCdekDto,
  ) {
    return this.adminOrdersService.updateCdekInfo(orderNumber, dto);
  }

  /**
   * Отправить произвольное письмо клиенту
   * POST /api/admin/orders/:orderNumber/send-email
   */
  @Post(':orderNumber/send-email')
  sendEmail(
    @Param('orderNumber') orderNumber: string,
    @Body() dto: SendEmailDto,
  ) {
    return this.adminOrdersService.sendCustomEmail(
      orderNumber,
      dto.subject,
      dto.message,
    );
  }
}
