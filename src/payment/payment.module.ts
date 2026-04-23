import { Module, forwardRef } from '@nestjs/common';
import { AlfaPayService } from './alfa-pay.service';
import { PaymentController } from './payment.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [PaymentController],
  providers: [AlfaPayService],
  exports: [AlfaPayService],
})
export class PaymentModule {}
