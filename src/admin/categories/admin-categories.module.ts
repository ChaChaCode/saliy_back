import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService } from './admin-categories.service';
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
  controllers: [AdminCategoriesController],
  providers: [AdminCategoriesService, SimpleCacheService],
  exports: [AdminCategoriesService],
})
export class AdminCategoriesModule {}
