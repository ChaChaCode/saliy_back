import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token должен быть строкой' })
  @IsNotEmpty({ message: 'Refresh token обязателен' })
  refreshToken: string;
}
