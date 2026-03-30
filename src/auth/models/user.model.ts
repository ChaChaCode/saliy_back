import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => String)
  id: string;

  @Field(() => String)
  email: string;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => String, { nullable: true })
  firstName: string | null;

  @Field(() => String, { nullable: true })
  lastName: string | null;

  @Field(() => String, { nullable: true })
  middleName: string | null;

  @Field(() => String, { nullable: true })
  phone: string | null;

  @Field(() => Date, { nullable: true })
  birthdate: Date | null;

  @Field(() => String, { nullable: true })
  socialContact: string | null;

  @Field(() => String, { nullable: true })
  street: string | null;

  @Field(() => String, { nullable: true })
  apartment: string | null;

  @Field(() => String, { nullable: true })
  postalCode: string | null;

  @Field(() => String, { nullable: true })
  deliveryType: string | null;

  @Field(() => Int, { nullable: true })
  cdekCityCode: number | null;

  @Field(() => String, { nullable: true })
  cdekCountryCode: string | null;

  @Field(() => Int, { nullable: true })
  cdekRegionCode: number | null;

  @Field(() => String, { nullable: true })
  cdekPickupPointCode: string | null;

  @Field(() => String, { nullable: true })
  cityName: string | null;

  @Field(() => String, { nullable: true })
  countryName: string | null;

  @Field(() => String, { nullable: true })
  regionName: string | null;

  @Field(() => String, { nullable: true })
  deliveryCountryCode: string | null;

  @Field(() => String, { nullable: true })
  fullAddress: string | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
