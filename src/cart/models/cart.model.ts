import { ObjectType, Field, Int, Float, InputType } from '@nestjs/graphql';
import { Product } from '../../products/models/product.model';

// Модель элемента корзины в БД
@ObjectType()
export class CartItem {
  @Field(() => Int)
  id: number;

  @Field()
  userId: string;

  @Field(() => Int)
  productId: number;

  @Field()
  size: string;

  @Field(() => Int)
  quantity: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Связь с товаром
  @Field(() => Product)
  product: Product;
}

// Валидированный элемент корзины (с актуальными ценами)
@ObjectType()
export class ValidatedCartItem {
  @Field(() => Int)
  productId: number;

  @Field()
  productName: string;

  @Field()
  productSlug: string;

  @Field()
  size: string;

  @Field(() => Int)
  quantity: number;

  @Field(() => Float)
  price: number; // Актуальная цена из БД

  @Field(() => Int)
  discount: number; // Актуальная скидка из БД

  @Field(() => Float)
  finalPrice: number; // Цена со скидкой

  @Field(() => Float)
  totalPrice: number; // finalPrice * quantity

  @Field()
  inStock: boolean; // Есть ли нужное количество на складе

  @Field(() => Int)
  availableQuantity: number; // Доступное количество

  @Field({ nullable: true })
  sizeChart?: string; // Размерная сетка

  @Field()
  imageUrl: string; // Превью изображения
}

// Ответ валидации корзины
@ObjectType()
export class ValidatedCart {
  @Field(() => [ValidatedCartItem])
  items: ValidatedCartItem[];

  @Field(() => Float)
  subtotal: number; // Сумма всех товаров

  @Field(() => Float)
  total: number; // Итого (пока без промокода)

  @Field(() => Int)
  itemsCount: number; // Общее количество товаров
}

// Input для GraphQL
import {
  IsInt,
  IsString,
  IsArray,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class CartItemInput {
  @Field(() => Int)
  @IsInt()
  productId: number;

  @Field()
  @IsString()
  size: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  quantity: number;
}

@InputType()
export class ValidateCartInput {
  @Field(() => [CartItemInput])
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemInput)
  items: CartItemInput[];
}
