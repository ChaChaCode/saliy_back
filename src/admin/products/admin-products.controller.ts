import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto, UpdateProductDto } from './dto/admin-product.dto';

@Controller('admin/products')
@UseGuards(AdminGuard)
export class AdminProductsController {
  constructor(private readonly adminProductsService: AdminProductsService) {}

  /**
   * Получить список всех товаров с фильтрацией
   * GET /admin/products
   */
  @Get()
  async getAllProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('gender') gender?: string,
    @Query('cardStatus') cardStatus?: string,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.adminProductsService.getAllProducts({
      page: pageNum,
      limit: limitNum,
      search,
      category,
      gender,
      cardStatus,
      isActive: isActive ? isActive === 'true' : undefined,
    });
  }

  /**
   * Получить товар по ID
   * GET /admin/products/:id
   */
  @Get(':id')
  async getProductById(@Param('id') id: string) {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      throw new BadRequestException('Invalid product ID');
    }

    const product = await this.adminProductsService.getProductById(productId);
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return product;
  }

  /**
   * Получить enums для товаров (категории, полы, статусы)
   * GET /admin/products/enums/all
   */
  @Get('enums/all')
  async getEnums() {
    return this.adminProductsService.getEnums();
  }

  /**
   * Товары с низким остатком на складе
   * GET /admin/products/low-stock?threshold=5
   */
  @Get('low-stock')
  async getLowStock(@Query('threshold') threshold?: string) {
    const t = threshold ? parseInt(threshold, 10) : 5;
    return this.adminProductsService.getLowStockProducts(t);
  }

  /**
   * Создать товар (с загрузкой фотографий)
   * POST /admin/products
   *
   * Поддерживает multipart/form-data. Первое изображение становится preview.
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 10 }], {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles()
    files?: { images?: Express.Multer.File[] },
  ) {
    return this.adminProductsService.createProduct(
      createProductDto,
      files?.images,
    );
  }

  /**
   * Удалить товар
   * DELETE /admin/products/:id
   *
   * Если есть связанные заказы — товар деактивируется, иначе удаляется физически.
   */
  @Delete(':id')
  async deleteProduct(@Param('id') id: string) {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      throw new BadRequestException('Invalid product ID');
    }
    return this.adminProductsService.deleteProduct(productId);
  }

  /**
   * Обновить товар (с загрузкой фотографий)
   * PATCH /admin/products/:id
   *
   * Поддерживает multipart/form-data для загрузки изображений
   * Поля изображений: images[] (до 10 файлов)
   */
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 10 }], {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles()
    files?: { images?: Express.Multer.File[] },
  ) {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      throw new BadRequestException('Invalid product ID');
    }

    return this.adminProductsService.updateProduct(
      productId,
      updateProductDto,
      files?.images,
    );
  }

  /**
   * Удалить конкретное изображение товара
   * PATCH /admin/products/:id/delete-image
   * Body: { imageUrl: string }  (полный URL или S3-ключ)
   */
  @Patch(':id/delete-image')
  async deleteProductImage(
    @Param('id') id: string,
    @Body('imageUrl') imageUrl: string,
  ) {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      throw new BadRequestException('Invalid product ID');
    }
    if (!imageUrl) {
      throw new BadRequestException('imageUrl is required');
    }
    return this.adminProductsService.deleteProductImage(productId, imageUrl);
  }

  /**
   * Добавить новые фото к существующему товару (без замены)
   * POST /admin/products/:id/images
   * multipart/form-data: поле images[] (до 10 файлов)
   */
  @Post(':id/images')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 10 }], {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async addProductImages(
    @Param('id') id: string,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      throw new BadRequestException('Invalid product ID');
    }
    return this.adminProductsService.addProductImages(
      productId,
      files?.images || [],
    );
  }

  /**
   * Установить превью-фото: primary (основное) + hover (опционально, при наведении).
   * PATCH /admin/products/:id/set-previews
   * Body: { primary: string, hover?: string | null }
   */
  @Patch(':id/set-previews')
  async setProductPreviews(
    @Param('id') id: string,
    @Body() body: { primary: string; hover?: string | null },
  ) {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      throw new BadRequestException('Invalid product ID');
    }
    if (!body?.primary) {
      throw new BadRequestException('primary is required');
    }
    return this.adminProductsService.setProductPreviews(productId, {
      primary: body.primary,
      hover: body.hover ?? null,
    });
  }
}
