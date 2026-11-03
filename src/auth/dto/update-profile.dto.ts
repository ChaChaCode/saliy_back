import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

// Обязательные поля: можно не передавать, но null не принимается (иначе поле
// стирается в БД — @IsOptional пропускает null без проверок).
const NotNullIfPresent = () => ValidateIf((_, value) => value !== undefined);

export class UpdateProfileDto {
  @NotNullIfPresent()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @NotNullIfPresent()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  middleName?: string | null; // null — очистить

  @NotNullIfPresent()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/, {
    message:
      'Дата рождения должна быть в формате ДД.ММ.ГГГГ (например: 13.07.2003)',
  })
  birthdate?: string | null; // DD.MM.YYYY; null — очистить (правило «раз в год»)

  @IsOptional()
  @IsString()
  @MaxLength(200)
  socialContact?: string | null; // null — очистить
}
