import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Данные приходят как multipart/form-data, поэтому все значения — строки.
// @Type / @Transform нужны, чтобы ValidationPipe(transform:true) сконвертил их.

export class CreateBannerDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
