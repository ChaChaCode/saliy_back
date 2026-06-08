import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './common/email/email.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ProductsModule } from './products/products.module';
import { AdminModule } from './admin/admin.module';
import { BannersModule } from './banners/banners.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PromoCodesModule } from './admin/promo-codes/promo-codes.module';
import { PromoModule } from './promo/promo.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { CacheModule } from './common/cache/cache.module';
import { StorageModule } from './common/storage/storage.module';
import { PaymentModule } from './payment/payment.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    CacheModule,
    StorageModule,
    // Rate limiting - 100 запросов в минуту на IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 минута
        limit: 100, // 100 запросов
      },
    ]),
    PrismaModule,
    EmailModule,
    AuthModule,
    DeliveryModule,
    ProductsModule,
    AdminModule,
    BannersModule,
    CartModule,
    OrdersModule,
    PromoCodesModule,
    PromoModule,
    ReviewsModule,
    NewsletterModule,
    PaymentModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Глобальный rate limiting guard для REST
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
