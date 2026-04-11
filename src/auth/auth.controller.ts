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
  Put,
  Delete,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateDeliveryLocationDto } from './dto/update-delivery-location.dto';
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
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, // Всегда true (для sameSite: 'none' обязательно)
      sameSite: isProduction ? 'lax' : 'none', // 'none' в dev для cross-origin
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
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true, // Всегда true (для sameSite: 'none' обязательно)
      sameSite: isProduction ? 'lax' : 'none', // 'none' в dev для cross-origin
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

    // Удаляем cookie (настройки должны совпадать с установкой)
    const isProduction = process.env.NODE_ENV === 'production';
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: isProduction ? 'lax' : 'none',
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

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() request: any,
    @Body(ValidationPipe) dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(request.user.id, dto);
  }

  @Put('delivery-location')
  @UseGuards(JwtAuthGuard)
  async updateDeliveryLocation(
    @Req() request: any,
    @Body(ValidationPipe) dto: UpdateDeliveryLocationDto,
  ) {
    return this.authService.updateDeliveryLocation(request.user.id, dto);
  }

  /**
   * Загрузить аватар
   * POST /api/auth/avatar  (multipart, field: "avatar")
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException('Разрешены только изображения (jpg/png/webp)'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadAvatar(
    @Req() request: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }
    return this.authService.uploadAvatar(request.user.id, file);
  }

  /**
   * Удалить аватар
   * DELETE /api/auth/avatar
   */
  @Delete('avatar')
  @UseGuards(JwtAuthGuard)
  async removeAvatar(@Req() request: any) {
    return this.authService.removeAvatar(request.user.id);
  }
}
