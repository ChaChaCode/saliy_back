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
   * Список пользователей
   * GET /api/admin/users
   */
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminUsersService.findAll({
      search,
      dateFrom,
      dateTo,
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
