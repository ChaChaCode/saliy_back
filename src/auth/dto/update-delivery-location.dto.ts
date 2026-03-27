import {
  IsIn,
  IsInt,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateDeliveryLocationDto {
  // Тип доставки (можно сохранить отдельно)
  @IsOptional()
  @IsIn(['CDEK', 'POST'])
  deliveryType?: 'CDEK' | 'POST';

  // === Вариант CDEK: Самовывоз из ПВЗ (только RU/BY) ===

  @IsOptional()
  @IsInt()
  @Min(1)
  cdekCityCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cdekPickupPointCode?: string; // Код выбранного ПВЗ

  // === Вариант POST: Почтовая доставка (любая страна) ===

  @IsOptional()
  @IsString()
  @MaxLength(2)
  deliveryCountryCode?: string; // Код страны (RU, PL, US, etc)

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fullAddress?: string; // Полный адрес одной строкой

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string; // Почтовый индекс
}
