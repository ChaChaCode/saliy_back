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
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { card_status, gender_type } from '@prisma/client';

// Данные приходят как multipart/form-data — всё строки.
// Для number — @Type(() => Number).
// Для boolean — @Transform(... === 'true').
// Для object/array — @Transform c JSON.parse (фронт шлёт JSON-строкой).

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' || value === true;

const parseJsonObject = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const parseJsonNumberArray = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value.map((v) => Number(v));
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr.map((v) => Number(v)) : value;
    } catch {
      return value;
    }
  }
  // Поддержка CSV: "1,2,3"
  return trimmed
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v));
};

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  @Transform(parseJsonObject)
  @IsObject()
  stock?: Record<string, number>;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(parseJsonNumberArray)
  @IsArray()
  @IsNumber({}, { each: true })
  categoryIds?: number[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

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
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  @Transform(parseJsonObject)
  @IsObject()
  stock?: Record<string, number>; // {"S": 10, "M": 5, "L": 0}

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(parseJsonNumberArray)
  @IsArray()
  @IsNumber({}, { each: true })
  categoryIds?: number[]; // ID категорий для связи
}

export class ProductImageDto {
  @IsString()
  url: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  previewOrder?: number;
}
