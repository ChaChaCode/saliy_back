import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminBannersController } from './admin-banners.controller';
import { AdminBannersService } from './admin-banners.service';
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
  controllers: [AdminBannersController],
  providers: [AdminBannersService, SimpleCacheService],
  exports: [AdminBannersService],
})
export class AdminBannersModule {}
