import { Module } from '@nestjs/common';
import { AdminBannersController } from './admin-banners.controller';
import { AdminBannersService } from './admin-banners.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminBannersController],
  providers: [AdminBannersService],
  exports: [AdminBannersService],
})
export class AdminBannersModule {}
