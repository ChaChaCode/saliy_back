import { IsInt, Min, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateDeliveryLocationDto {
  // Вариант 1: CDEK (RU, BY) - выбор города через селекты
  @ValidateIf((o) => !o.deliveryCountryCode)
  @IsInt()
  @Min(1)
  cdekCityCode?: number;

  // Вариант 2: Другие страны - ввод адреса вручную
  @ValidateIf((o) => !o.cdekCityCode)
  @IsString()
  @MaxLength(2)
  deliveryCountryCode?: string;

  @ValidateIf((o) => o.deliveryCountryCode)
  @IsString()
  @MaxLength(500)
  fullAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;
}
