import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { S3StorageService } from '../common/storage/s3-storage.service';

@Injectable()
export class BannersService {
  private readonly s3Prefix = 'banners';

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3StorageService,
  ) {}

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

    const desktopImageUrl = await this.uploadFile(desktopImage, 'desktop');
    const mobileImageUrl = await this.uploadFile(mobileImage, 'mobile');

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

  async findAll() {
    return this.prisma.banner.findMany({ orderBy: { order: 'asc' } });
  }

  async findActive() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }
    return banner;
  }

  async update(
    id: string,
    dto: UpdateBannerDto,
    desktopImage?: Express.Multer.File,
    mobileImage?: Express.Multer.File,
  ) {
    const banner = await this.findOne(id);

    const updateData: any = { ...dto };

    if (desktopImage) {
      await this.s3.delete(banner.desktopImageUrl);
      updateData.desktopImageUrl = await this.uploadFile(desktopImage, 'desktop');
    }

    if (mobileImage) {
      await this.s3.delete(banner.mobileImageUrl);
      updateData.mobileImageUrl = await this.uploadFile(mobileImage, 'mobile');
    }

    return this.prisma.banner.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const banner = await this.findOne(id);

    await this.s3.delete(banner.desktopImageUrl);
    await this.s3.delete(banner.mobileImageUrl);

    return this.prisma.banner.delete({ where: { id } });
  }

  private async uploadFile(
    file: Express.Multer.File,
    type: 'desktop' | 'mobile',
  ): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `${this.s3Prefix}/${type}-${Date.now()}.${ext}`;
    return this.s3.upload(key, file.buffer, file.mimetype);
  }
}
