import {
  IsInt,
  IsString,
  IsArray,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO для добавления товара в корзину
export class AddToCartDto {
  @IsInt()
  productId: number;

  @IsString()
  size: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

// DTO для обновления количества
export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  quantity: number;
}

// DTO для элемента корзины (от клиента - только ID, размер, количество)
export class CartItemDto {
  @IsInt()
  productId: number;

  @IsString()
  size: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

// DTO для валидации корзины (от гостя или авторизованного)
export class ValidateCartDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}

// DTO для объединения корзины при входе
export class MergeCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}
