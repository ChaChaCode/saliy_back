import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/admin-category.dto';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'categories');

  constructor(private prisma: PrismaService) {
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create uploads directory', error);
    }
  }

  /**
   * Получить все категории
   */
  async getAllCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      productsCount: cat._count.products,
      _count: undefined,
    }));
  }

  /**
   * Получить категорию по ID
   */
  async getCategoryById(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  /**
   * Создать новую категорию
   */
  async createCategory(
    createCategoryDto: CreateCategoryDto,
    desktopBannerFile?: Express.Multer.File,
    mobileBannerFile?: Express.Multer.File,
  ) {
    // Проверка уникальности slug
    const existingCategory = await this.prisma.category.findUnique({
      where: { slug: createCategoryDto.slug },
    });

    if (existingCategory) {
      throw new BadRequestException(
        `Category with slug "${createCategoryDto.slug}" already exists`,
      );
    }

    // Создаём категорию
    const category = await this.prisma.category.create({
      data: {
        ...createCategoryDto,
        type: createCategoryDto.type || 'OTHER',
        isActive: createCategoryDto.isActive ?? true,
      },
    });

    // Загружаем баннеры, если есть
    let desktopBannerUrl: string | undefined;
    let mobileBannerUrl: string | undefined;

    if (desktopBannerFile) {
      desktopBannerUrl = await this.saveBannerFile(
        desktopBannerFile,
        category.id,
        'desktop',
      );
    }

    if (mobileBannerFile) {
      mobileBannerUrl = await this.saveBannerFile(
        mobileBannerFile,
        category.id,
        'mobile',
      );
    }

    // Обновляем категорию с URL баннеров
    if (desktopBannerUrl || mobileBannerUrl) {
      const updateData: any = {};
      if (desktopBannerUrl) updateData.desktopBannerUrl = desktopBannerUrl;
      if (mobileBannerUrl) updateData.mobileBannerUrl = mobileBannerUrl;

      return this.prisma.category.update({
        where: { id: category.id },
        data: updateData,
      });
    }

    return category;
  }

  /**
   * Обновить категорию
   */
  async updateCategory(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    desktopBannerFile?: Express.Multer.File,
    mobileBannerFile?: Express.Multer.File,
  ) {
    // Проверяем существование категории
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Проверка уникальности slug (если меняется)
    if (updateCategoryDto.slug && updateCategoryDto.slug !== existingCategory.slug) {
      const slugExists = await this.prisma.category.findUnique({
        where: { slug: updateCategoryDto.slug },
      });

      if (slugExists) {
        throw new BadRequestException(
          `Category with slug "${updateCategoryDto.slug}" already exists`,
        );
      }
    }

    const updateData: any = { ...updateCategoryDto };

    // Обработка desktop баннера
    if (desktopBannerFile) {
      // Удаляем старый файл
      if (existingCategory.desktopBannerUrl) {
        await this.deleteBannerFile(existingCategory.desktopBannerUrl);
      }

      updateData.desktopBannerUrl = await this.saveBannerFile(
        desktopBannerFile,
        id,
        'desktop',
      );
    }

    // Обработка mobile баннера
    if (mobileBannerFile) {
      // Удаляем старый файл
      if (existingCategory.mobileBannerUrl) {
        await this.deleteBannerFile(existingCategory.mobileBannerUrl);
      }

      updateData.mobileBannerUrl = await this.saveBannerFile(
        mobileBannerFile,
        id,
        'mobile',
      );
    }

    return this.prisma.category.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Удалить категорию
   */
  async deleteCategory(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    if (category._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.products} associated products`,
      );
    }

    // Удаляем файлы баннеров
    if (category.desktopBannerUrl) {
      await this.deleteBannerFile(category.desktopBannerUrl);
    }

    if (category.mobileBannerUrl) {
      await this.deleteBannerFile(category.mobileBannerUrl);
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return {
      message: `Category "${category.name}" deleted successfully`,
    };
  }

  /**
   * Сохранить файл баннера
   */
  private async saveBannerFile(
    file: Express.Multer.File,
    categoryId: number,
    type: 'desktop' | 'mobile',
  ): Promise<string> {
    const ext = file.originalname.split('.').pop();
    const filename = `${type}-cat${categoryId}-${Date.now()}.${ext}`;
    const filepath = join(this.uploadsDir, filename);

    try {
      await fs.writeFile(filepath, file.buffer);
      return `/uploads/categories/${filename}`;
    } catch (error) {
      this.logger.error(`Failed to save banner file: ${filename}`, error);
      throw new BadRequestException('Failed to save banner file');
    }
  }

  /**
   * Удалить файл баннера
   */
  private async deleteBannerFile(url: string): Promise<void> {
    const filename = url.split('/').pop();
    if (!filename) return;

    const filepath = join(this.uploadsDir, filename);

    try {
      await fs.unlink(filepath);
    } catch (error) {
      this.logger.warn(`Failed to delete banner file: ${filename}`, error);
    }
  }
}
