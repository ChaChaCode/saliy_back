import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Body() sendCodeDto: SendCodeDto) {
    await this.authService.sendVerificationCode(sendCodeDto.email);
    return {
      message: 'Код отправлен на email',
    };
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyCode(
    @Body() verifyCodeDto: VerifyCodeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.verifyCode(
      verifyCodeDto.email,
      verifyCodeDto.code,
    );

    // Устанавливаем refresh token в httpOnly cookie
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // только HTTPS в продакшене
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      path: '/',
    });

    return {
      accessToken,
      message: 'Успешная авторизация',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token не найден');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshTokens(refreshToken);

    // Обновляем refresh token в cookie
    response.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      accessToken,
      message: 'Токен обновлен',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Удаляем cookie
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      message: 'Выход выполнен',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() request: any) {
    return request.user;
  }
}
