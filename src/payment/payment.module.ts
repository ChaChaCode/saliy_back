import { Module, forwardRef } from '@nestjs/common';
import { AlfaPayService } from './alfa-pay.service';
import { YandexPayService } from './yandex-pay.service';
import { TochkaPayService } from './tochka-pay.service';
import { PaymentController } from './payment.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [PaymentController],
  providers: [AlfaPayService, YandexPayService, TochkaPayService],
  exports: [AlfaPayService, YandexPayService, TochkaPayService],
})
export class PaymentModule {}
