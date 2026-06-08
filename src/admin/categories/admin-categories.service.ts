import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/admin-category.dto';

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  async createCategory(createCategoryDto: CreateCategoryDto) {
    // Проверка уникальности slug
    const existingCategory = await this.prisma.category.findUnique({
      where: { slug: createCategoryDto.slug },
    });
    if (existingCategory) {
      throw new BadRequestException(
        `Category with slug "${createCategoryDto.slug}" already exists`,
      );
    }

    return this.prisma.category.create({
      data: {
        ...createCategoryDto,
        type: createCategoryDto.type || 'OTHER',
        isActive: createCategoryDto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: number, updateCategoryDto: UpdateCategoryDto) {
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

    return this.prisma.category.update({
      where: { id },
      data: { ...updateCategoryDto },
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

    await this.prisma.category.delete({ where: { id } });

    return { message: `Category "${category.name}" deleted successfully` };
  }
}
