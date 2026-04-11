import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('admin/audit')
@UseGuards(AdminGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/admin/audit
   */
  @Get()
  findAll(
    @Query('adminId') adminId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll({
      adminId,
      entityType,
      action,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
