import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../common/email/email.module';
import { PromoModule } from '../promo/promo.module';
import { CartModule } from '../cart/cart.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    CartModule,
    forwardRef(() => PromoModule),
    forwardRef(() => PaymentModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
