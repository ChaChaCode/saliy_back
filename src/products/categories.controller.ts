import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Получить все активные категории
   * GET /api/categories
   */
  @Get()
  async getCategories() {
    return this.productsService.getCategories();
  }

  /**
   * Получить категорию по slug
   * GET /api/categories/:slug
   */
  @Get(':slug')
  async getCategoryBySlug(@Param('slug') slug: string) {
    const category = await this.productsService.getCategoryBySlug(slug);

    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    return category;
  }

  /**
   * Получить товары категории с пагинацией
   * GET /api/categories/:slug/products?limit=20&offset=0
   */
  @Get(':slug/products')
  async getCategoryProducts(
    @Param('slug') slug: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
  ) {
    // Проверяем что категория существует
    const category = await this.productsService.getCategoryBySlug(slug);

    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    // Получаем товары этой категории
    const result = await this.productsService.getProducts({
      categorySlug: slug,
      limit,
      offset,
    });

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        type: category.type,
      },
      products: result.products,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  /**
   * Загрузить баннеры для категории
   * PUT /api/categories/:id/banners
   */
  @Put(':id/banners')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'desktopBanner', maxCount: 1 },
      { name: 'mobileBanner', maxCount: 1 },
    ]),
  )
  async uploadCategoryBanners(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles()
    files?: {
      desktopBanner?: Express.Multer.File[];
      mobileBanner?: Express.Multer.File[];
    },
  ) {
    if (!files?.desktopBanner && !files?.mobileBanner) {
      throw new BadRequestException(
        'At least one banner image (desktop or mobile) is required',
      );
    }

    return this.productsService.updateCategoryBanners(
      id,
      files?.desktopBanner?.[0],
      files?.mobileBanner?.[0],
    );
  }
}
