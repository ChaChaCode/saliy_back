import { Module } from '@nestjs/common';
import { YandexPayService } from './yandex-pay.service';
import { PaymentController } from './payment.controller';
import { OrdersModule } from '../orders/orders.module';
import { EmailModule } from '../common/email/email.module';

@Module({
  imports: [OrdersModule, EmailModule],
  controllers: [PaymentController],
  providers: [YandexPayService],
  exports: [YandexPayService],
})
export class PaymentModule {}
