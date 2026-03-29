import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/promo-code.dto';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('admin/promo-codes')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  /**
   * Создать промокод
   * POST /api/admin/promo-codes
   */
  @Post()
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promoCodesService.create(dto);
  }

  /**
   * Получить все промокоды
   * GET /api/admin/promo-codes
   */
  @Get()
  findAll(
    @Query('isActive') isActive?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.promoCodesService.findAll({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      type,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Получить промокод по ID
   * GET /api/admin/promo-codes/:id
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.promoCodesService.findOne(id);
  }

  /**
   * Обновить промокод
   * PUT /api/admin/promo-codes/:id
   */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    return this.promoCodesService.update(id, dto);
  }

  /**
   * Удалить промокод
   * DELETE /api/admin/promo-codes/:id
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.promoCodesService.remove(id);
  }

  /**
   * Деактивировать промокод
   * POST /api/admin/promo-codes/:id/deactivate
   */
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.promoCodesService.deactivate(id);
  }

  /**
   * Получить статистику использований
   * GET /api/admin/promo-codes/:id/stats
   */
  @Get(':id/stats')
  getUsageStats(@Param('id', ParseIntPipe) id: number) {
    return this.promoCodesService.getUsageStats(id);
  }
}
