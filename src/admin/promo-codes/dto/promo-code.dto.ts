import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';
import { PromoType, PromoAppliesTo } from '@prisma/client';

export class CreatePromoCodeDto {
  @IsString()
  code: string;

  @IsEnum(PromoType)
  type: PromoType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsEnum(PromoAppliesTo)
  appliesTo?: PromoAppliesTo;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  specificProductIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  excludedProductIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedUserIds?: string[]; // UUID массив

  @IsOptional()
  @IsBoolean()
  requiresAuth?: boolean; // Требуется авторизация (true = только для зарегистрированных)

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxItems?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsBoolean()
  excludeNewItems?: boolean; // Не применять к товарам с cardStatus=NEW (по умолчанию true)

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(PromoType)
  type?: PromoType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsEnum(PromoAppliesTo)
  appliesTo?: PromoAppliesTo;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  specificProductIds?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  excludedProductIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  requiresAuth?: boolean; // Требуется авторизация (true = только для зарегистрированных)

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxItems?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsBoolean()
  excludeNewItems?: boolean; // Не применять к товарам с cardStatus=NEW

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ValidatePromoCodeDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsNumber()
  orderAmount?: number;

  @IsOptional()
  @IsArray()
  cartItems?: Array<{
    productId: number;
    quantity: number;
    price: number;
  }>;
}
