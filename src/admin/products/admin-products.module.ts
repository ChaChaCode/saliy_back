import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SimpleCacheService } from '../../common/cache/simple-cache.service';
import { getAdminSecret } from '../../common/utils/jwt-secrets';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: getAdminSecret(),
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AdminProductsController],
  providers: [AdminProductsService, SimpleCacheService],
  exports: [AdminProductsService],
})
export class AdminProductsModule {}
