import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { CampaignsService } from './campaigns.service';
import { AdminGuard } from '../../common/guards/admin.guard';

class CreateCampaignDto {
  @IsString() @IsNotEmpty() subject: string;
  @IsString() @IsNotEmpty() html: string;
  @IsOptional()
  @IsIn(['ALL', 'WITH_ORDERS', 'WITHOUT_ORDERS'])
  targetType?: 'ALL' | 'WITH_ORDERS' | 'WITHOUT_ORDERS';
}

@Controller('admin/campaigns')
@UseGuards(AdminGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.campaignsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCampaignDto, @Req() req: any) {
    return this.campaignsService.create(dto, req.admin?.id);
  }

  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.campaignsService.startSending(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }
}
