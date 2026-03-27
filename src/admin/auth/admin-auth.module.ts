import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SimpleCacheService } from '../../common/cache/simple-cache.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_ADMIN_SECRET || 'admin-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, SimpleCacheService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
