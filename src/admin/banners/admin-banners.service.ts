import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/admin-banner.dto';
import { S3StorageService } from '../../common/storage/s3-storage.service';

@Injectable()
export class AdminBannersService {
  private readonly logger = new Logger(AdminBannersService.name);
  private readonly s3Prefix = 'banners';

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
  ) {}

  async getAllBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getBannerById(id: string) {
    return this.prisma.banner.findUnique({ where: { id } });
  }

  async createBanner(
    createBannerDto: CreateBannerDto,
    desktopImageFile: Express.Multer.File,
    mobileImageFile: Express.Multer.File,
  ) {
    // Создаём запись с временными плейсхолдерами, чтобы получить id
    const banner = await this.prisma.banner.create({
      data: {
        ...createBannerDto,
        desktopImageUrl: 'temp',
        mobileImageUrl: 'temp',
        order: createBannerDto.order ?? 0,
        isActive: createBannerDto.isActive ?? true,
      },
    });

    try {
      const desktopImageUrl = await this.uploadBannerFile(
        desktopImageFile,
        banner.id,
        'desktop',
      );
      const mobileImageUrl = await this.uploadBannerFile(
        mobileImageFile,
        banner.id,
        'mobile',
      );

      return this.prisma.banner.update({
        where: { id: banner.id },
        data: { desktopImageUrl, mobileImageUrl },
      });
    } catch (error) {
      // Откатываем запись, если S3 upload не удался
      await this.prisma.banner.delete({ where: { id: banner.id } }).catch(() => {});
      throw error;
    }
  }

  async updateBanner(
    id: string,
    updateBannerDto: UpdateBannerDto,
    desktopImageFile?: Express.Multer.File,
    mobileImageFile?: Express.Multer.File,
  ) {
    const existingBanner = await this.prisma.banner.findUnique({ where: { id } });
    if (!existingBanner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    const updateData: any = { ...updateBannerDto };

    if (desktopImageFile) {
      await this.s3.delete(existingBanner.desktopImageUrl);
      updateData.desktopImageUrl = await this.uploadBannerFile(
        desktopImageFile,
        id,
        'desktop',
      );
    }

    if (mobileImageFile) {
      await this.s3.delete(existingBanner.mobileImageUrl);
      updateData.mobileImageUrl = await this.uploadBannerFile(
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

  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    await this.s3.delete(banner.desktopImageUrl);
    await this.s3.delete(banner.mobileImageUrl);

    await this.prisma.banner.delete({ where: { id } });

    return { message: `Banner "${banner.title}" deleted successfully` };
  }

  private async uploadBannerFile(
    file: Express.Multer.File,
    bannerId: string,
    type: 'desktop' | 'mobile',
  ): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${this.s3Prefix}/${type}-banner-${bannerId}-${Date.now()}.${ext}`;

    try {
      return await this.s3.upload(key, file.buffer, file.mimetype);
    } catch (error: any) {
      this.logger.error(`Failed to upload banner file to S3: ${key}`, error);
      throw new BadRequestException('Failed to save banner file');
    }
  }
}
