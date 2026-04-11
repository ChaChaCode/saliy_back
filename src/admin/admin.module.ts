import { Module } from '@nestjs/common';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminProductsModule } from './products/admin-products.module';
import { AdminCategoriesModule } from './categories/admin-categories.module';
import { AdminBannersModule } from './banners/admin-banners.module';
import { AdminOrdersModule } from './orders/admin-orders.module';
import { AdminUsersModule } from './users/admin-users.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminSettingsModule } from './settings/admin-settings.module';
import { AdminsModule } from './admins/admins.module';
import { AuditModule } from './audit/audit.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { TelegramWebhookController } from './webhook/telegram-webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SimpleCacheService } from '../common/cache/simple-cache.service';

@Module({
  imports: [
    AdminAuthModule,
    AdminProductsModule,
    AdminCategoriesModule,
    AdminBannersModule,
    AdminOrdersModule,
    AdminUsersModule,
    AdminDashboardModule,
    AdminSettingsModule,
    AdminsModule,
    AuditModule,
    CampaignsModule,
    PrismaModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [SimpleCacheService],
  exports: [
    AdminAuthModule,
    AdminProductsModule,
    AdminCategoriesModule,
    AdminBannersModule,
    AdminOrdersModule,
    AdminUsersModule,
    AdminDashboardModule,
    AdminSettingsModule,
    AdminsModule,
    AuditModule,
    CampaignsModule,
  ],
})
export class AdminModule {}
