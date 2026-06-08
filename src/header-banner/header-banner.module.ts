import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminSettingsModule } from '../admin/settings/admin-settings.module';
import { HeaderBannerService } from './header-banner.service';
import {
  HeaderBannerController,
  AdminHeaderBannerController,
} from './header-banner.controller';

@Module({
  imports: [PrismaModule, JwtModule.register({}), AdminSettingsModule],
  controllers: [HeaderBannerController, AdminHeaderBannerController],
  providers: [HeaderBannerService],
  exports: [HeaderBannerService],
})
export class HeaderBannerModule {}
