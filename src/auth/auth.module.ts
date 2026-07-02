import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../common/email/email.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { getAccessSecret } from '../common/utils/jwt-secrets';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getAccessSecret(),
      signOptions: { expiresIn: '15m' },
    }),
    EmailModule,
    DeliveryModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
