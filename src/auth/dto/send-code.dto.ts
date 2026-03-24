import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendCodeDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @IsNotEmpty({ message: 'Email обязателен' })
  email: string;
}
