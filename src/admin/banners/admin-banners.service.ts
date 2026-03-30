import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/admin-banner.dto';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class AdminBannersService {
  private readonly logger = new Logger(AdminBannersService.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'banners');

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
   * Получить все баннеры
   */
  async getAllBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Получить баннер по ID
   */
  async getBannerById(id: string) {
    return this.prisma.banner.findUnique({
      where: { id },
    });
  }

  /**
   * Создать новый баннер
   */
  async createBanner(
    createBannerDto: CreateBannerDto,
    desktopImageFile: Express.Multer.File,
    mobileImageFile: Express.Multer.File,
  ) {
    // Создаём баннер с временными URL
    const banner = await this.prisma.banner.create({
      data: {
        ...createBannerDto,
        desktopImageUrl: 'temp',
        mobileImageUrl: 'temp',
        order: createBannerDto.order ?? 0,
        isActive: createBannerDto.isActive ?? true,
      },
    });

    // Сохраняем изображения
    const desktopImageUrl = await this.saveBannerFile(
      desktopImageFile,
      banner.id,
      'desktop',
    );
    const mobileImageUrl = await this.saveBannerFile(
      mobileImageFile,
      banner.id,
      'mobile',
    );

    // Обновляем баннер с реальными URL
    return this.prisma.banner.update({
      where: { id: banner.id },
      data: {
        desktopImageUrl,
        mobileImageUrl,
      },
    });
  }

  /**
   * Обновить баннер
   */
  async updateBanner(
    id: string,
    updateBannerDto: UpdateBannerDto,
    desktopImageFile?: Express.Multer.File,
    mobileImageFile?: Express.Multer.File,
  ) {
    // Проверяем существование баннера
    const existingBanner = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    const updateData: any = { ...updateBannerDto };

    // Обработка desktop изображения
    if (desktopImageFile) {
      await this.deleteBannerFile(existingBanner.desktopImageUrl);
      updateData.desktopImageUrl = await this.saveBannerFile(
        desktopImageFile,
        id,
        'desktop',
      );
    }

    // Обработка mobile изображения
    if (mobileImageFile) {
      await this.deleteBannerFile(existingBanner.mobileImageUrl);
      updateData.mobileImageUrl = await this.saveBannerFile(
        mobileImageFile,
        id,
        'mobile',
      );
    }

    return this.prisma.banner.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Удалить баннер
   */
  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    // Удаляем файлы изображений
    await this.deleteBannerFile(banner.desktopImageUrl);
    await this.deleteBannerFile(banner.mobileImageUrl);

    await this.prisma.banner.delete({
      where: { id },
    });

    return {
      message: `Banner "${banner.title}" deleted successfully`,
    };
  }

  /**
   * Сохранить файл баннера
   */
  private async saveBannerFile(
    file: Express.Multer.File,
    bannerId: string,
    type: 'desktop' | 'mobile',
  ): Promise<string> {
    const ext = file.originalname.split('.').pop();
    const filename = `${type}-banner-${bannerId}-${Date.now()}.${ext}`;
    const filepath = join(this.uploadsDir, filename);

    try {
      await fs.writeFile(filepath, file.buffer);
      return `/uploads/banners/${filename}`;
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
