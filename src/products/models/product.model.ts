import { ObjectType, Field, Int, Float, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSONObject, GraphQLJSON } from 'graphql-type-json';
import { Category } from './category.model';

export enum CardStatus {
  NONE = 'NONE',
  NEW = 'NEW',
  SALE = 'SALE',
  SOLD_OUT = 'SOLD_OUT',
  PRE_ORDER = 'PRE_ORDER',
  COMING_SOON = 'COMING_SOON',
}

export enum GenderType {
  MALE = 'male',
  FEMALE = 'female',
  UNISEX = 'unisex',
}

registerEnumType(CardStatus, {
  name: 'CardStatus',
});

registerEnumType(GenderType, {
  name: 'GenderType',
});

@ObjectType()
export class ProductCategory {
  @Field(() => Int)
  id: number;

  @Field(() => Category)
  category: Category;
}

@ObjectType()
export class Product {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => CardStatus)
  cardStatus: CardStatus;

  @Field(() => GenderType)
  gender: GenderType;

  @Field({ nullable: true })
  color?: string;

  @Field(() => Float, { nullable: true })
  weight?: number;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  discount: number;

  @Field(() => GraphQLJSON)
  images: any;

  @Field(() => GraphQLJSON)
  stock: any;

  @Field()
  isActive: boolean;

  @Field(() => Int)
  viewCount: number;

  @Field(() => Int)
  salesCount: number;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => Date, { nullable: true })
  updatedAt: Date | null;

  @Field(() => [ProductCategory], { nullable: true })
  categories?: ProductCategory[];

  // Вычисляемое поле - финальная цена со скидкой
  @Field(() => Float)
  finalPrice: number;
}

// Для ответов со списком товаров
@ObjectType()
export class ProductsResponse {
  @Field(() => [Product])
  products: Product[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  offset: number;
}
