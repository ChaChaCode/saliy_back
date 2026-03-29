import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { PromoService } from './promo.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  /**
   * Валидировать промокод
   * POST /api/promo/validate
   * Доступно и гостям, и авторизованным
   */
  @Post('validate')
  @UseGuards(OptionalJwtAuthGuard)
  async validatePromoCode(@Req() req: any, @Body() dto: ValidatePromoDto) {
    const userId = req.user?.id;
    return this.promoService.validatePromoCode(dto, userId);
  }
}
