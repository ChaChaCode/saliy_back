import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminCategoriesService } from './admin-categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/admin-category.dto';

@Controller('admin/categories')
@UseGuards(AdminGuard)
export class AdminCategoriesController {
  constructor(
    private readonly adminCategoriesService: AdminCategoriesService,
  ) {}

  /**
   * Получить список всех категорий
   * GET /admin/categories
   */
  @Get()
  async getAllCategories() {
    return this.adminCategoriesService.getAllCategories();
  }

  /**
   * Получить категорию по ID
   * GET /admin/categories/:id
   */
  @Get(':id')
  async getCategoryById(@Param('id') id: string) {
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      throw new BadRequestException('Invalid category ID');
    }

    const category =
      await this.adminCategoriesService.getCategoryById(categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    return category;
  }

  /**
   * Создать новую категорию (с загрузкой баннеров)
   * POST /admin/categories
   *
   * Поддерживает multipart/form-data
   * Поля изображений: desktopBanner, mobileBanner
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'desktopBanner', maxCount: 1 },
        { name: 'mobileBanner', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB
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
      },
    ),
  )
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFiles()
    files?: {
      desktopBanner?: Express.Multer.File[];
      mobileBanner?: Express.Multer.File[];
    },
  ) {
    return this.adminCategoriesService.createCategory(
      createCategoryDto,
      files?.desktopBanner?.[0],
      files?.mobileBanner?.[0],
    );
  }

  /**
   * Обновить категорию (с загрузкой баннеров)
   * PATCH /admin/categories/:id
   */
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'desktopBanner', maxCount: 1 },
        { name: 'mobileBanner', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB
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
      },
    ),
  )
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @UploadedFiles()
    files?: {
      desktopBanner?: Express.Multer.File[];
      mobileBanner?: Express.Multer.File[];
    },
  ) {
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      throw new BadRequestException('Invalid category ID');
    }

    return this.adminCategoriesService.updateCategory(
      categoryId,
      updateCategoryDto,
      files?.desktopBanner?.[0],
      files?.mobileBanner?.[0],
    );
  }

  /**
   * Удалить категорию
   * DELETE /admin/categories/:id
   */
  @Delete(':id')
  async deleteCategory(@Param('id') id: string) {
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      throw new BadRequestException('Invalid category ID');
    }

    return this.adminCategoriesService.deleteCategory(categoryId);
  }
}
