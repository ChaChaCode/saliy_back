import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { HeaderBannerService } from './header-banner.service';
import { AdminGuard } from '../common/guards/admin.guard';

class UpdateHeaderBannerDto {
  @IsString()
  @MaxLength(500)
  text: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/**
 * Публичный эндпоинт: витрина читает текст баннера для шапки.
 * GET /api/header-banner
 */
@Controller('header-banner')
export class HeaderBannerController {
  constructor(private readonly service: HeaderBannerService) {}

  @Get()
  get() {
    return this.service.get();
  }
}

/**
 * Админский эндпоинт: задать текст и видимость баннера.
 * PUT /api/admin/header-banner
 */
@Controller('admin/header-banner')
@UseGuards(AdminGuard)
export class AdminHeaderBannerController {
  constructor(private readonly service: HeaderBannerService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  update(@Body() dto: UpdateHeaderBannerDto) {
    return this.service.set(dto.text, dto.enabled ?? true);
  }
}
