import { Resolver, Query, Args, Int, ResolveField, Parent } from '@nestjs/graphql';
import { ProductsService } from './products.service';
import { Product, ProductsResponse } from './models/product.model';
import { Category } from './models/category.model';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  // Получить список товаров
  @Query(() => ProductsResponse, { name: 'products' })
  async getProducts(
    @Args('categorySlug', { type: () => String, nullable: true })
    categorySlug?: string,
    @Args('gender', { type: () => String, nullable: true })
    gender?: string,
    @Args('status', { type: () => String, nullable: true })
    status?: string,
    @Args('minPrice', { type: () => Int, nullable: true })
    minPrice?: number,
    @Args('maxPrice', { type: () => Int, nullable: true })
    maxPrice?: number,
    @Args('inStock', { type: () => Boolean, nullable: true })
    inStock?: boolean,
    @Args('sortBy', { type: () => String, nullable: true })
    sortBy?: string,
    @Args('sortOrder', { type: () => String, nullable: true })
    sortOrder?: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
    limit?: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset?: number,
  ) {
    return this.productsService.getProducts({
      categorySlug,
      gender: gender as any,
      status: status as any,
      minPrice,
      maxPrice,
      inStock,
      sortBy,
      sortOrder,
      limit,
      offset,
    });
  }

  // Поиск товаров
  @Query(() => [Product], { name: 'searchProducts' })
  async searchProducts(
    @Args('query', { type: () => String }) query: string,
  ) {
    return this.productsService.searchProducts(query);
  }

  // Популярные товары
  @Query(() => [Product], { name: 'popularProducts' })
  async getPopularProducts(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 })
    limit?: number,
  ) {
    return this.productsService.getPopularProducts(limit);
  }

  // Товары в распродаже
  @Query(() => [Product], { name: 'saleProducts' })
  async getSaleProducts(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
    limit?: number,
  ) {
    return this.productsService.getSaleProducts(limit);
  }

  // Новинки
  @Query(() => [Product], { name: 'newProducts' })
  async getNewProducts(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
    limit?: number,
  ) {
    return this.productsService.getNewProducts(limit);
  }

  // Получить товар по slug
  @Query(() => Product, { name: 'product' })
  async getProductBySlug(
    @Args('slug', { type: () => String }) slug: string,
  ) {
    return this.productsService.getProductBySlug(slug);
  }

  // Вычисляемое поле - финальная цена
  @ResolveField(() => Number)
  finalPrice(@Parent() product: Product) {
    return Math.floor(
      product.price - (product.price * product.discount) / 100,
    );
  }
}

@Resolver(() => Category)
export class CategoriesResolver {
  constructor(private readonly productsService: ProductsService) {}

  // Получить все категории
  @Query(() => [Category], { name: 'categories' })
  async getCategories() {
    return this.productsService.getCategories();
  }

  // Получить категорию по slug
  @Query(() => Category, { name: 'category' })
  async getCategoryBySlug(
    @Args('slug', { type: () => String }) slug: string,
  ) {
    return this.productsService.getCategoryBySlug(slug);
  }
}
