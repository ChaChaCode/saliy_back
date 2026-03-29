import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ValidatePromoDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsNumber()
  orderAmount?: number;

  @IsOptional()
  @IsArray()
  cartItems?: Array<{
    productId: number;
    quantity: number;
    price: number;
  }>;
}
