import { TbankPayService } from './tbank-pay.service';
import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [PaymentController],
  providers: [TbankPayService],
  exports: [TbankPayService],
})
export class PaymentModule {}
