import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  /**
   * Создать новый баннер с изображениями
   * POST /banners
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'desktopImage', maxCount: 1 },
      { name: 'mobileImage', maxCount: 1 },
    ]),
  )
  async create(
    @Body() createBannerDto: CreateBannerDto,
    @UploadedFiles()
    files: {
      desktopImage?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
  ) {
    if (!files?.desktopImage?.[0] || !files?.mobileImage?.[0]) {
      throw new BadRequestException(
        'Both desktopImage and mobileImage are required',
      );
    }

    return this.bannersService.create(
      createBannerDto,
      files.desktopImage[0],
      files.mobileImage[0],
    );
  }

  /**
   * Получить все баннеры (для админки)
   * GET /banners
   */
  @Get()
  async findAll() {
    return this.bannersService.findAll();
  }

  /**
   * Получить только активные баннеры (для клиентского сайта)
   * GET /banners/active
   */
  @Get('active')
  async findActive() {
    return this.bannersService.findActive();
  }

  /**
   * Получить активные баннеры для главной страницы
   * GET /banners/active/main
   */
  @Get('active/main')
  async findActiveMainPage() {
    return this.bannersService.findActiveMainPage();
  }

  /**
   * Получить активные баннеры для категории
   * GET /banners/active/category/:categoryId
   */
  @Get('active/category/:categoryId')
  async findActiveByCategory(@Param('categoryId') categoryId: string) {
    return this.bannersService.findActiveByCategory(parseInt(categoryId, 10));
  }

  /**
   * Получить один баннер по ID
   * GET /banners/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  /**
   * Обновить баннер (с возможностью загрузки новых изображений)
   * PUT /banners/:id
   */
  @Put(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'desktopImage', maxCount: 1 },
      { name: 'mobileImage', maxCount: 1 },
    ]),
  )
  async update(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @UploadedFiles()
    files?: {
      desktopImage?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
    },
  ) {
    return this.bannersService.update(
      id,
      updateBannerDto,
      files?.desktopImage?.[0],
      files?.mobileImage?.[0],
    );
  }

  /**
   * Удалить баннер
   * DELETE /banners/:id
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
