import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { card_status, gender_type } from '@prisma/client';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(card_status)
  cardStatus?: card_status;

  @IsOptional()
  @IsEnum(gender_type)
  gender?: gender_type;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  @IsObject()
  stock?: Record<string, number>; // {"S": 10, "M": 5, "L": 0}

  @IsOptional()
  @IsObject()
  sizeChart?: Record<string, any>; // Размерная таблица

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  categoryIds?: number[]; // ID категорий для связи
}

export class ProductImageDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @IsNumber()
  previewOrder?: number;
}
