import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { category_type } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsEnum(category_type)
  type?: category_type;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsEnum(category_type)
  type?: category_type;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
