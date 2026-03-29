import {
  IsString,
  IsEmail,
  IsArray,
  IsInt,
  IsEnum,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryType, PaymentMethod } from '@prisma/client';

// Элемент заказа от клиента (ТОЛЬКО ID, размер, количество - НЕ ЦЕНЫ!)
export class OrderItemDto {
  @IsInt()
  productId: number;

  @IsString()
  size: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

// DTO для создания заказа
export class CreateOrderDto {
  // Товары (ТОЛЬКО ID, размер, количество)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  // Информация о клиенте
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  phone: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  socialContact?: string; // Telegram: @username или Instagram: @username

  // Тип доставки
  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  // Метод оплаты
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // Адрес (опционально, зависит от типа доставки)
  @IsOptional()
  @IsString()
  countryName?: string;

  @IsOptional()
  @IsString()
  regionName?: string;

  @IsOptional()
  @IsString()
  cityName?: string;

  @IsOptional()
  @IsInt()
  cdekCityCode?: number;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  apartment?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  pickupPoint?: string; // Код ПВЗ CDEK

  // Промокод (опционально)
  @IsOptional()
  @IsString()
  promoCode?: string;
}
