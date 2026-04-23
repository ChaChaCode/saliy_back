import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DeliveryModule } from '../../delivery/delivery.module';

@Module({
  imports: [PrismaModule, JwtModule.register({}), DeliveryModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
