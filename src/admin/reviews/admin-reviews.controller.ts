import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from '../../reviews/reviews.service';
import type { ReviewStatus } from '../../reviews/reviews.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin/reviews')
@UseGuards(AdminGuard)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** GET /api/admin/reviews/stats */
  @Get('stats')
  getStats() {
    return this.reviewsService.getStats();
  }

  /** GET /api/admin/reviews */
  @Get()
  findAll(
    @Query('status') status?: ReviewStatus,
    @Query('productId') productId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.findAllAdmin({
      status,
      productId: productId ? parseInt(productId, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** POST /api/admin/reviews/:id/approve */
  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.approve(id, req.admin?.id);
  }

  /** POST /api/admin/reviews/:id/reject */
  @Post(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.reject(id, req.admin?.id);
  }

  /** DELETE /api/admin/reviews/:id */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
