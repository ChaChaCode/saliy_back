import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminGuard } from '../../common/guards/admin.guard';

const VALID_PERIODS = ['day', 'week', 'month', 'year'] as const;
type Period = (typeof VALID_PERIODS)[number];

@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  /**
   * Главная сводка для дашборда
   * GET /api/admin/dashboard/overview
   */
  @Get('overview')
  getOverview() {
    return this.dashboardService.getOverview();
  }

  /**
   * График выручки
   * GET /api/admin/dashboard/revenue?period=month
   */
  @Get('revenue')
  getRevenueChart(@Query('period') period?: string) {
    const p = (period || 'month') as Period;
    if (!VALID_PERIODS.includes(p)) {
      throw new BadRequestException(
        `period должен быть одним из: ${VALID_PERIODS.join(', ')}`,
      );
    }
    return this.dashboardService.getRevenueChart(p);
  }

  /**
   * Топ товаров
   * GET /api/admin/dashboard/top-products?limit=10
   */
  @Get('top-products')
  getTopProducts(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getTopProducts(n);
  }

  /**
   * Последние заказы
   * GET /api/admin/dashboard/recent-orders?limit=10
   */
  @Get('recent-orders')
  getRecentOrders(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentOrders(n);
  }

  /**
   * Бизнес-метрики: рост, средний чек, конверсия, зависшие деньги, возвраты
   * GET /api/admin/dashboard/business-metrics
   */
  @Get('business-metrics')
  getBusinessMetrics() {
    return this.dashboardService.getBusinessMetrics();
  }

  /**
   * Складская аналитика
   * GET /api/admin/dashboard/inventory?threshold=5
   */
  @Get('inventory')
  getInventory(@Query('threshold') threshold?: string) {
    let t = threshold ? parseInt(threshold, 10) : 5;
    if (!Number.isFinite(t) || t < 0) t = 5;
    return this.dashboardService.getInventory(t);
  }

  /**
   * Разбивка заказов по статусу / оплате / доставке
   * GET /api/admin/dashboard/orders-breakdown
   */
  @Get('orders-breakdown')
  getOrdersBreakdown() {
    return this.dashboardService.getOrdersBreakdown();
  }

  /**
   * Активность: отзывы, рассылка, корзины, новые пользователи
   * GET /api/admin/dashboard/activity
   */
  @Get('activity')
  getActivity() {
    return this.dashboardService.getActivity();
  }
}
