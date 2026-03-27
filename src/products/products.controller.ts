import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  FilterProductsDto,
} from './products.dto';
import { AdminGuard } from '../common/guards';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ==================== CRUD ====================

  /**
   * Создать товар
   * POST /api/products
   * @requires AdminGuard - Только для авторизованных администраторов
   */
  @Post()
  @UseGuards(AdminGuard)
  async createProduct(@Body(ValidationPipe) dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  /**
   * Получить список товаров с фильтрацией
   * GET /api/products?categorySlug=hoodies&gender=unisex&limit=20
   */
  @Get()
  async getProducts(@Query(ValidationPipe) filters: FilterProductsDto) {
    return this.productsService.getProducts(filters);
  }

  /**
   * Поиск товаров
   * GET /api/products/search?q=толстовка
   * Rate limit: 20 запросов в минуту
   */
  @Get('search')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async searchProducts(@Query('q') query: string) {
    return this.productsService.searchProducts(query);
  }

  /**
   * Популярные товары
   * GET /api/products/popular?limit=10
   */
  @Get('popular')
  async getPopularProducts(@Query('limit', ParseIntPipe) limit?: number) {
    return this.productsService.getPopularProducts(limit);
  }

  /**
   * Товары в распродаже
   * GET /api/products/sale?limit=20
   */
  @Get('sale')
  async getSaleProducts(@Query('limit', ParseIntPipe) limit?: number) {
    return this.productsService.getSaleProducts(limit);
  }

  /**
   * Новинки
   * GET /api/products/new?limit=20
   */
  @Get('new')
  async getNewProducts(@Query('limit', ParseIntPipe) limit?: number) {
    return this.productsService.getNewProducts(limit);
  }

  /**
   * Получить товар по slug
   * GET /api/products/:slug
   */
  @Get(':slug')
  async getProductBySlug(@Param('slug') slug: string) {
    return this.productsService.getProductBySlug(slug);
  }

  /**
   * Обновить товар
   * PUT /api/products/:id
   * @requires AdminGuard - Только для авторизованных администраторов
   */
  @Put(':id')
  @UseGuards(AdminGuard)
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(id, dto);
  }

  /**
   * Удалить товар
   * DELETE /api/products/:id
   * @requires AdminGuard - Только для авторизованных администраторов
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deleteProduct(id);
  }

  // ==================== ОСТАТКИ ====================

  /**
   * Проверить наличие товара
   * GET /api/products/:id/stock?size=M
   */
  @Get(':id/stock')
  async checkStock(
    @Param('id', ParseIntPipe) id: number,
    @Query('size') size: string,
  ) {
    const inStock = await this.productsService.isInStock(id, size);
    const quantity = await this.productsService.getStockQuantity(id, size);

    return {
      productId: id,
      size,
      inStock,
      quantity,
    };
  }

  // ==================== ЦЕНЫ ====================

  /**
   * Получить итоговую цену товара со скидкой
   * GET /api/products/:id/price
   */
  @Get(':id/price')
  async getFinalPrice(@Param('id', ParseIntPipe) id: number) {
    const product = await this.productsService.getProductById(id);
    const finalPrice = Math.floor(product.price - (product.price * product.discount) / 100);

    return {
      productId: id,
      price: product.price,
      discount: product.discount,
      finalPrice,
      savings: product.price - finalPrice,
      currency: 'RUB'
    };
  }
}
