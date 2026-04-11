import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { AdminRole } from '@prisma/client';
import { AdminsService } from './admins.service';
import { AdminGuard } from '../../common/guards/admin.guard';

class CreateAdminDto {
  @IsString()
  telegramId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}

class UpdateAdminDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('admin/admins')
@UseGuards(AdminGuard)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  findAll() {
    return this.adminsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAdminDto) {
    return this.adminsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.adminsService.remove(id, req.admin?.id);
  }
}
