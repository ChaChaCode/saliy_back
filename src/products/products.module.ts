import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsResolver, CategoriesResolver } from './products.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { SimpleCacheService } from '../common/cache/simple-cache.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}), // Для AdminGuard
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductsResolver,
    CategoriesResolver,
    SimpleCacheService, // Для AdminGuard
  ],
  exports: [ProductsService], // Экспортируем для использования в других модулях
})
export class ProductsModule {}
