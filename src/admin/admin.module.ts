import { Module } from '@nestjs/common';
import { AdminAuthModule } from './auth/admin-auth.module';
import { AdminProductsModule } from './products/admin-products.module';
import { AdminCategoriesModule } from './categories/admin-categories.module';
import { AdminBannersModule } from './banners/admin-banners.module';
import { TelegramWebhookController } from './webhook/telegram-webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SimpleCacheService } from '../common/cache/simple-cache.service';

@Module({
  imports: [
    AdminAuthModule,
    AdminProductsModule,
    AdminCategoriesModule,
    AdminBannersModule,
    PrismaModule,
  ],
  controllers: [TelegramWebhookController],
  providers: [SimpleCacheService],
  exports: [
    AdminAuthModule,
    AdminProductsModule,
    AdminCategoriesModule,
    AdminBannersModule,
  ],
})
export class AdminModule {}
