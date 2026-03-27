import { Module } from '@nestjs/common';
import { AdminAuthModule } from './auth/admin-auth.module';
import { TelegramWebhookController } from './webhook/telegram-webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SimpleCacheService } from '../common/cache/simple-cache.service';

@Module({
  imports: [AdminAuthModule, PrismaModule],
  controllers: [TelegramWebhookController],
  providers: [SimpleCacheService],
  exports: [AdminAuthModule],
})
export class AdminModule {}
