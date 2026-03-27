import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class BannersService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'banners');

  constructor(private readonly prisma: PrismaService) {
    // Создаем директорию для загрузок при старте
    this.ensureUploadsDirExists();
  }

  private async ensureUploadsDirExists() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create uploads directory:', error);
    }
  }

  /**
   * Создать новый баннер
   */
  async create(
    dto: CreateBannerDto,
    desktopImage: Express.Multer.File,
    mobileImage: Express.Multer.File,
  ) {
    if (!desktopImage || !mobileImage) {
      throw new BadRequestException(
        'Both desktop and mobile images are required',
      );
    }

    // Сохраняем файлы
    const desktopImageUrl = await this.saveFile(desktopImage, 'desktop');
    const mobileImageUrl = await this.saveFile(mobileImage, 'mobile');

    // Создаем баннер в БД
    return this.prisma.banner.create({
      data: {
        title: dto.title,
        description: dto.description,
        desktopImageUrl,
        mobileImageUrl,
        link: dto.link,
        order: dto.order || 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Получить все баннеры
   */
  async findAll() {
    return this.prisma.banner.findMany({
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Получить только активные баннеры (для главной страницы)
   */
  async findActive() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Получить баннер по ID
   */
  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    return banner;
  }

  /**
   * Обновить баннер
   */
  async update(
    id: string,
    dto: UpdateBannerDto,
    desktopImage?: Express.Multer.File,
    mobileImage?: Express.Multer.File,
  ) {
    const banner = await this.findOne(id);

    const updateData: any = {
      ...dto,
    };

    // Если загружено новое изображение для десктопа
    if (desktopImage) {
      // Удаляем старое
      await this.deleteFile(banner.desktopImageUrl);
      // Сохраняем новое
      updateData.desktopImageUrl = await this.saveFile(desktopImage, 'desktop');
    }

    // Если загружено новое изображение для мобильной версии
    if (mobileImage) {
      // Удаляем старое
      await this.deleteFile(banner.mobileImageUrl);
      // Сохраняем новое
      updateData.mobileImageUrl = await this.saveFile(mobileImage, 'mobile');
    }

    return this.prisma.banner.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Удалить баннер
   */
  async remove(id: string) {
    const banner = await this.findOne(id);

    // Удаляем файлы
    await this.deleteFile(banner.desktopImageUrl);
    await this.deleteFile(banner.mobileImageUrl);

    // Удаляем из БД
    return this.prisma.banner.delete({
      where: { id },
    });
  }

  /**
   * Сохранить файл на диск
   */
  private async saveFile(
    file: Express.Multer.File,
    type: 'desktop' | 'mobile',
  ): Promise<string> {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${type}-${timestamp}${ext}`;
    const filepath = path.join(this.uploadsDir, filename);

    await fs.writeFile(filepath, file.buffer);

    // Возвращаем относительный URL
    return `/uploads/banners/${filename}`;
  }

  /**
   * Удалить файл с диска
   */
  private async deleteFile(url: string) {
    try {
      // Извлекаем имя файла из URL
      const filename = path.basename(url);
      const filepath = path.join(this.uploadsDir, filename);

      await fs.unlink(filepath);
    } catch (error) {
      console.error(`Failed to delete file ${url}:`, error);
    }
  }
}
