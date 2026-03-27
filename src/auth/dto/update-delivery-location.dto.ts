import {
  IsIn,
  IsInt,
  Min,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateDeliveryLocationDto {
  // Шаг 1: Выбор типа доставки (обязательно)
  @IsIn(['CDEK', 'POST'])
  deliveryType: 'CDEK' | 'POST';

  // === Вариант CDEK: Самовывоз из ПВЗ (только RU/BY) ===

  @ValidateIf((o) => o.deliveryType === 'CDEK')
  @IsInt()
  @Min(1)
  cdekCityCode?: number;

  @ValidateIf((o) => o.deliveryType === 'CDEK')
  @IsString()
  @MaxLength(100)
  cdekPickupPointCode?: string; // Код выбранного ПВЗ

  // === Вариант POST: Почтовая доставка (любая страна) ===

  @ValidateIf((o) => o.deliveryType === 'POST')
  @IsString()
  @MaxLength(2)
  deliveryCountryCode?: string; // Код страны (RU, PL, US, etc)

  @ValidateIf((o) => o.deliveryType === 'POST')
  @IsString()
  @MaxLength(500)
  fullAddress?: string; // Полный адрес одной строкой

  @ValidateIf((o) => o.deliveryType === 'POST')
  @IsString()
  @MaxLength(20)
  postalCode?: string; // Почтовый индекс (обязательно только для POST)
}
