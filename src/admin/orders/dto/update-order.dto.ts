import {
  IsEnum,
  IsOptional,
  IsString,
  IsEmail,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, DeliveryType, PaymentMethod } from '@prisma/client';

/** Одна позиция при редактировании состава заказа (цены берём из БД, не от клиента) */
export class OrderItemEditDto {
  @IsInt() productId: number;
  @IsString() size: string;
  @IsInt() @Min(1) quantity: number;
}

/** Новый состав заказа целиком (заменяет текущие позиции) */
export class UpdateOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemEditDto)
  items: OrderItemEditDto[];
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Обновление произвольных полей заказа из админки
 * (все поля опциональны — меняем только что передано)
 */
export class UpdateOrderDto {
  // Клиент
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() socialContact?: string;
  @IsOptional() @IsString() comment?: string;

  // Адрес
  @IsOptional() @IsString() countryName?: string;
  @IsOptional() @IsString() regionName?: string;
  @IsOptional() @IsString() cityName?: string;
  @IsOptional() @IsInt() cdekCityCode?: number;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() apartment?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() pickupPoint?: string;

  // Доставка и оплата
  @IsOptional() @IsEnum(DeliveryType) deliveryType?: DeliveryType;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  @IsOptional() @IsNumber() @Min(0) deliveryPrice?: number;
  @IsOptional() @IsNumber() @Min(0) deliveryTotal?: number;

  // Оплата / статус
  @IsOptional() @IsBoolean() isPaid?: boolean;
  @IsOptional() @IsString() paymentId?: string;
}
