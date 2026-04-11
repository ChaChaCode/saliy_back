import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service';
import { AdminGuard } from '../../common/guards/admin.guard';

interface UpsertSettingDto {
  value: any;
  description?: string;
}

@Controller('admin/settings')
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  /** GET /api/admin/settings */
  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  /** GET /api/admin/settings/:key */
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  /** PUT /api/admin/settings/:key */
  @Put(':key')
  upsert(@Param('key') key: string, @Body() dto: UpsertSettingDto) {
    return this.settingsService.upsert(key, dto.value, dto.description);
  }

  /** DELETE /api/admin/settings/:key */
  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}
