import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  name: string | null;

  @Field({ nullable: true })
  firstName: string | null;

  @Field({ nullable: true })
  lastName: string | null;

  @Field({ nullable: true })
  middleName: string | null;

  @Field({ nullable: true })
  phone: string | null;

  @Field({ nullable: true })
  birthdate: Date | null;

  @Field({ nullable: true })
  socialContact: string | null;

  @Field({ nullable: true })
  street: string | null;

  @Field({ nullable: true })
  apartment: string | null;

  @Field({ nullable: true })
  postalCode: string | null;

  @Field({ nullable: true })
  deliveryType: string | null;

  @Field(() => Int, { nullable: true })
  cdekCityCode: number | null;

  @Field({ nullable: true })
  cdekCountryCode: string | null;

  @Field(() => Int, { nullable: true })
  cdekRegionCode: number | null;

  @Field({ nullable: true })
  cdekPickupPointCode: string | null;

  @Field({ nullable: true })
  cityName: string | null;

  @Field({ nullable: true })
  countryName: string | null;

  @Field({ nullable: true })
  regionName: string | null;

  @Field({ nullable: true })
  deliveryCountryCode: string | null;

  @Field({ nullable: true })
  fullAddress: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
