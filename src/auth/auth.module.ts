import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DeliveryModule } from '../delivery/delivery.module';

// Вход покупателей — Better Auth (подключается в app.module.ts).
// Этот модуль — профиль покупателя и проверка сессии для guard'ов.
@Module({
  imports: [DeliveryModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
