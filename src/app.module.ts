import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
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
import { CacheModule } from './common/cache/cache.module';
// import { PaymentModule } from './payment/payment.module'; // Отложено

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule,
    // Rate limiting - 100 запросов в минуту на IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 минута
        limit: 100, // 100 запросов
      },
    ]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req, res }) => ({ req, res }),
    }),
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
    // PaymentModule, // Отложено - пока заказы сразу оплачены
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppResolver,
    // Глобальный rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
