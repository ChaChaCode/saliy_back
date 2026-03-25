import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsResolver, CategoriesResolver } from './products.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsResolver, CategoriesResolver],
  exports: [ProductsService], // Экспортируем для использования в других модулях
})
export class ProductsModule {}
