import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ReviewsService } from './reviews.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

class CreateReviewDto {
  @IsInt()
  productId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  authorName: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Создать отзыв (можно и гостям)
   * POST /api/reviews
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(@Body() dto: CreateReviewDto, @Req() req: any) {
    return this.reviewsService.create(dto, req.user?.id);
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
