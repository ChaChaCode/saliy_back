import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  middleName?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  birthdate?: Date;

  @Field({ nullable: true })
  socialContact?: string;

  @Field({ nullable: true })
  street?: string;

  @Field({ nullable: true })
  apartment?: string;

  @Field({ nullable: true })
  postalCode?: string;

  @Field({ nullable: true })
  deliveryType?: string;

  @Field({ nullable: true })
  cdekCityCode?: string;

  @Field({ nullable: true })
  cdekCountryCode?: string;

  @Field({ nullable: true })
  cdekRegionCode?: string;

  @Field({ nullable: true })
  cdekPickupPointCode?: string;

  @Field({ nullable: true })
  cityName?: string;

  @Field({ nullable: true })
  countryName?: string;

  @Field({ nullable: true })
  regionName?: string;

  @Field({ nullable: true })
  deliveryCountryCode?: string;

  @Field({ nullable: true })
  fullAddress?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
