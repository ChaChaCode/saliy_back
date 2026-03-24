import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

@InputType()
export class VerifyCodeInput {
  @Field()
  @IsEmail({}, { message: 'Некорректный email' })
  @IsNotEmpty({ message: 'Email обязателен' })
  email: string;

  @Field()
  @IsString({ message: 'Код должен быть строкой' })
  @IsNotEmpty({ message: 'Код обязателен' })
  @Length(4, 4, { message: 'Код должен содержать 4 цифры' })
  code: string;
}
