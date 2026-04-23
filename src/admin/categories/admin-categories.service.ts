import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/admin-category.dto';
import { S3StorageService } from '../../common/storage/s3-storage.service';

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);
  private readonly s3Prefix = 'categories';

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
  ) {}

  async getAllCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      productsCount: cat._count.products,
      _count: undefined,
    }));
  }

  async getCategoryById(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });
  }

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

    // Создаём категорию, чтобы получить id для ключа S3
    const category = await this.prisma.category.create({
      data: {
        ...createCategoryDto,
        type: createCategoryDto.type || 'OTHER',
        isActive: createCategoryDto.isActive ?? true,
      },
    });

    try {
      const updateData: {
        desktopBannerUrl?: string;
        mobileBannerUrl?: string;
      } = {};

      if (desktopBannerFile) {
        updateData.desktopBannerUrl = await this.uploadBanner(
          desktopBannerFile,
          category.id,
          'desktop',
        );
      }
      if (mobileBannerFile) {
        updateData.mobileBannerUrl = await this.uploadBanner(
          mobileBannerFile,
          category.id,
          'mobile',
        );
      }

      if (updateData.desktopBannerUrl || updateData.mobileBannerUrl) {
        return this.prisma.category.update({
          where: { id: category.id },
          data: updateData,
        });
      }

      return category;
    } catch (error) {
      // Откатываем запись, если загрузка в S3 упала
      await this.prisma.category
        .delete({ where: { id: category.id } })
        .catch(() => {});
      throw error;
    }
  }

  async updateCategory(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    desktopBannerFile?: Express.Multer.File,
    mobileBannerFile?: Express.Multer.File,
  ) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!existingCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Проверка уникальности slug (если меняется)
    if (
      updateCategoryDto.slug &&
      updateCategoryDto.slug !== existingCategory.slug
    ) {
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

    if (desktopBannerFile) {
      await this.s3.delete(existingCategory.desktopBannerUrl);
      updateData.desktopBannerUrl = await this.uploadBanner(
        desktopBannerFile,
        id,
        'desktop',
      );
    }

    if (mobileBannerFile) {
      await this.s3.delete(existingCategory.mobileBannerUrl);
      updateData.mobileBannerUrl = await this.uploadBanner(
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

  async deleteCategory(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
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

    await this.s3.delete(category.desktopBannerUrl);
    await this.s3.delete(category.mobileBannerUrl);

    await this.prisma.category.delete({ where: { id } });

    return { message: `Category "${category.name}" deleted successfully` };
  }

  /**
   * Загрузить баннер категории в S3.
   * Ключ: categories/{type}-cat{id}-{timestamp}.ext
   */
  private async uploadBanner(
    file: Express.Multer.File,
    categoryId: number,
    type: 'desktop' | 'mobile',
  ): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${this.s3Prefix}/${type}-cat${categoryId}-${Date.now()}.${ext}`;
    try {
      return await this.s3.upload(key, file.buffer, file.mimetype);
    } catch (error: any) {
      this.logger.error(`Failed to upload category banner to S3: ${key}`, error);
      throw new BadRequestException('Failed to save banner file');
    }
  }
}
