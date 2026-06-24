import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DeliveryModule } from '../../delivery/delivery.module';
import { OrdersModule } from '../../orders/orders.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    DeliveryModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
