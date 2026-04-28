import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NewsletterService } from '../../newsletter/newsletter.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin/newsletter')
@UseGuards(AdminGuard)
export class AdminNewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  /** GET /api/admin/newsletter/stats */
  @Get('stats')
  getStats() {
    return this.newsletterService.getStats();
  }

  /** GET /api/admin/newsletter */
  @Get()
  findAll(
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.newsletterService.findAllAdmin({
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /** DELETE /api/admin/newsletter/:id */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.newsletterService.deleteSubscriber(id);
  }
}
