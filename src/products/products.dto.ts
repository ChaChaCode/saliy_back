import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsObject,
  Min,
  IsInt,
} from 'class-validator';

// Enum'ы
export enum CardStatus {
  NONE = 'NONE',
  NEW = 'NEW',
  SALE = 'SALE',
  SOLD_OUT = 'SOLD_OUT',
  PRE_ORDER = 'PRE_ORDER',
  COMING_SOON = 'COMING_SOON',
}

export enum GenderType {
  MALE = 'male',
  FEMALE = 'female',
  UNISEX = 'unisex',
}

// DTO для создания товара
export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CardStatus)
  cardStatus?: CardStatus;

  @IsOptional()
  @IsEnum(GenderType)
  gender?: GenderType;

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
  price?: number; // Цена в рублях

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number; // Скидка 0-100%

  @IsOptional()
  @IsObject()
  images?: any; // JSON

  @IsOptional()
  @IsObject()
  stock?: any; // JSON

  @IsOptional()
  @IsObject()
  sizeChart?: any; // JSON - размерная таблица

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt({ each: true })
  categoryIds?: number[]; // ID категорий
}

// DTO для обновления товара
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
  @IsEnum(CardStatus)
  cardStatus?: CardStatus;

  @IsOptional()
  @IsEnum(GenderType)
  gender?: GenderType;

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
  @IsInt()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsObject()
  images?: any;

  @IsOptional()
  @IsObject()
  stock?: any;

  @IsOptional()
  @IsObject()
  sizeChart?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt({ each: true })
  categoryIds?: number[];
}

// DTO для фильтрации товаров
export class FilterProductsDto {
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
