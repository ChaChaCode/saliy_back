import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  /**
   * Статистика по пользователям
   * GET /api/admin/users/stats
   */
  @Get('stats')
  getStats() {
    return this.adminUsersService.getStats();
  }

  /**
   * Список пользователей с фильтрами, агрегатами и сортировкой.
   * GET /api/admin/users
   * Query: search, dateFrom, dateTo, hasOrders, sortBy, sortOrder, page, limit
   */
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('hasOrders') hasOrders?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'ordersCount' | 'totalSpent' | 'lastOrderAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminUsersService.findAll({
      search,
      dateFrom,
      dateTo,
      hasOrders:
        hasOrders === 'true' ? true : hasOrders === 'false' ? false : undefined,
      sortBy,
      sortOrder,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Получить пользователя по ID
   * GET /api/admin/users/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  /**
   * Удалить пользователя
   * DELETE /api/admin/users/:id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminUsersService.remove(id);
  }
}
