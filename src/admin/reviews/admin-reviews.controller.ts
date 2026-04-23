import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReviewsService,
  REVIEW_MAX_TEXT,
  REVIEW_MAX_IMAGES,
} from '../../reviews/reviews.service';
import type { ReviewStatus } from '../../reviews/reviews.service';
import { AdminGuard } from '../../common/guards/admin.guard';

const REVIEW_STATUSES: ReviewStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

class AdminCreateReviewDto {
  @Type(() => Number)
  @IsInt()
  productId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  authorName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_MAX_TEXT)
  text?: string;

  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: ReviewStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

class AdminUpdateReviewDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  authorName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_MAX_TEXT)
  text?: string | null;

  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: ReviewStatus;
}

const imageFileFilter = (
  _req: any,
  file: Express.Multer.File,
  callback: (err: Error | null, ok: boolean) => void,
) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return callback(
      new BadRequestException('Only image files are allowed'),
      false,
    );
  }
  callback(null, true);
};

@Controller('admin/reviews')
@UseGuards(AdminGuard)
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** GET /api/admin/reviews/stats */
  @Get('stats')
  getStats() {
    return this.reviewsService.getStats();
  }

  /**
   * Список всех отзывов с фильтрами + авторы/товары
   * GET /api/admin/reviews
   * Query: status, productId, userId, search, page, limit
   */
  @Get()
  findAll(
    @Query('status') status?: ReviewStatus,
    @Query('productId') productId?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.findAllAdmin({
      status,
      productId: productId ? parseInt(productId, 10) : undefined,
      userId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Получить один отзыв с полной инфой (автор + товар)
   * GET /api/admin/reviews/:id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findAdminById(id);
  }

  /**
   * Создать отзыв от имени админа (можно сразу APPROVED).
   * Bypass проверки DELIVERED-заказа.
   * POST /api/admin/reviews
   * multipart/form-data: поля DTO + images[] (до 5)
   */
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: REVIEW_MAX_IMAGES }], {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  create(
    @Body() dto: AdminCreateReviewDto,
    @Req() req: any,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    return this.reviewsService.createAsAdmin(
      dto,
      files?.images || [],
      req.admin?.id,
    );
  }

  /**
   * Отредактировать отзыв (text / rating / authorName / status)
   * PATCH /api/admin/reviews/:id
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateReviewDto,
    @Req() req: any,
  ) {
    return this.reviewsService.updateAsAdmin(id, dto, req.admin?.id);
  }

  /**
   * Добавить фото к существующему отзыву (до 5 суммарно)
   * POST /api/admin/reviews/:id/images
   * multipart/form-data: images[]
   */
  @Post(':id/images')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: REVIEW_MAX_IMAGES }], {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  addImages(
    @Param('id') id: string,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    return this.reviewsService.addImagesAdmin(id, files?.images || []);
  }

  /**
   * Удалить одно фото из отзыва
   * PATCH /api/admin/reviews/:id/delete-image
   * body: { imageUrl }
   */
  @Patch(':id/delete-image')
  deleteImage(
    @Param('id') id: string,
    @Body('imageUrl') imageUrl: string,
  ) {
    if (!imageUrl) {
      throw new BadRequestException('imageUrl is required');
    }
    return this.reviewsService.removeImageAdmin(id, imageUrl);
  }

  /** POST /api/admin/reviews/:id/approve */
  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.approve(id, req.admin?.id);
  }

  /** POST /api/admin/reviews/:id/reject */
  @Post(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.reject(id, req.admin?.id);
  }

  /** DELETE /api/admin/reviews/:id */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
