import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  middleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/, {
    message: 'Дата рождения должна быть в формате ДД.ММ.ГГГГ (например: 13.07.2003)',
  })
  birthdate?: string; // Дата рождения в формате DD.MM.YYYY

  @IsOptional()
  @IsString()
  @MaxLength(200)
  socialContact?: string;
}
