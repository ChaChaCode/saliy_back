import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
   * Создать новую категорию
   * POST /admin/categories
   */
  @Post()
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.adminCategoriesService.createCategory(createCategoryDto);
  }

  /**
   * Обновить категорию
   * PATCH /admin/categories/:id
   */
  @Patch(':id')
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    const categoryId = parseInt(id, 10);
    if (isNaN(categoryId)) {
      throw new BadRequestException('Invalid category ID');
    }

    return this.adminCategoriesService.updateCategory(
      categoryId,
      updateCategoryDto,
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
