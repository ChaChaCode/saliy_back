import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Req,
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
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReviewsService,
  REVIEW_MAX_TEXT,
  REVIEW_MAX_IMAGES,
} from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CreateReviewDto {
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
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Создать отзыв (только для авторизованных с полученным заказом).
   * Принимает multipart/form-data: поля DTO + images (до 5 файлов).
   *
   * POST /api/reviews
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'images', maxCount: REVIEW_MAX_IMAGES }],
      {
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB на файл
        fileFilter: (_req, file, callback) => {
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
  create(
    @Body() dto: CreateReviewDto,
    @Req() req: any,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    return this.reviewsService.create(dto, req.user.id, files?.images || []);
  }

  /**
   * Проверить, может ли текущий пользователь оставить отзыв на товар.
   * GET /api/reviews/can-review/:productId
   */
  @Get('can-review/:productId')
  @UseGuards(JwtAuthGuard)
  canReview(
    @Param('productId', ParseIntPipe) productId: number,
    @Req() req: any,
  ) {
    return this.reviewsService.canReview(productId, req.user.id);
  }

  /**
   * Получить одобренные отзывы товара
   * GET /api/reviews/product/:productId
   */
  @Get('product/:productId')
  findByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.reviewsService.findByProduct(productId);
  }
}
