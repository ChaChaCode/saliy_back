import { TbankPayService } from './tbank-pay.service';
import { YandexPayService } from './yandex-pay.service';
import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [PaymentController],
  providers: [TbankPayService, YandexPayService],
  exports: [TbankPayService, YandexPayService],
})
export class PaymentModule {}
