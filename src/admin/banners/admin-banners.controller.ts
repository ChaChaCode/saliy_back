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
import { AdminBannersService } from './admin-banners.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/admin-banner.dto';

@Controller('admin/banners')
@UseGuards(AdminGuard)
export class AdminBannersController {
  constructor(private readonly adminBannersService: AdminBannersService) {}

  /**
   * Получить список всех баннеров
   * GET /admin/banners
   */
  @Get()
  async getAllBanners() {
    return this.adminBannersService.getAllBanners();
  }

  /**
   * Получить баннер по ID
   * GET /admin/banners/:id
   */
  @Get(':id')
  async getBannerById(@Param('id') id: string) {
    const banner = await this.adminBannersService.getBannerById(id);
    if (!banner) {
      throw new NotFoundException(`Banner with ID ${id} not found`);
    }

    return banner;
  }

  /**
   * Создать новый баннер (с загрузкой изображений)
   * POST /admin/banners
   *
   * Поддерживает multipart/form-data
   * Поля изображений: desktopImage, mobileImage (оба обязательны)
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'desktopImage', maxCount: 1 },
        { name: 'mobileImage', maxCount: 1 },
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
  async createBanner(
    @Body() createBannerDto: CreateBannerDto,
    @UploadedFiles()
    files?: {
      desktopImage?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
  ) {
    if (!files?.desktopImage || !files?.mobileImage) {
      throw new BadRequestException(
        'Both desktop and mobile images are required',
      );
    }

    return this.adminBannersService.createBanner(
      createBannerDto,
      files.desktopImage[0],
      files.mobileImage[0],
    );
  }

  /**
   * Обновить баннер (с загрузкой изображений)
   * PATCH /admin/banners/:id
   */
  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'desktopImage', maxCount: 1 },
        { name: 'mobileImage', maxCount: 1 },
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
  async updateBanner(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @UploadedFiles()
    files?: {
      desktopImage?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
  ) {
    return this.adminBannersService.updateBanner(
      id,
      updateBannerDto,
      files?.desktopImage?.[0],
      files?.mobileImage?.[0],
    );
  }

  /**
   * Удалить баннер
   * DELETE /admin/banners/:id
   */
  @Delete(':id')
  async deleteBanner(@Param('id') id: string) {
    return this.adminBannersService.deleteBanner(id);
  }
}
