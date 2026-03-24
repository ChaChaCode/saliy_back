import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken: string;

  @Field()
  message: string;
}

@ObjectType()
export class MessageResponse {
  @Field()
  message: string;
}
