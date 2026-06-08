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

    this.setAuthCookies(response, accessToken, refreshToken);

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

    this.setAuthCookies(response, accessToken, newRefreshToken);

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

    // Удаляем обе куки (настройки должны совпадать с установкой)
    const opts = this.cookieOptions();
    response.clearCookie('accessToken', opts);
    response.clearCookie('refreshToken', opts);

    return {
      message: 'Выход выполнен',
    };
  }

  /**
   * Общие опции для auth-кук.
   * secure: true всегда (требуется для sameSite: 'none' в dev cross-origin).
   */
  private cookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: true,
      sameSite: (isProduction ? 'lax' : 'none') as 'lax' | 'none',
      path: '/',
    };
  }

  /**
   * Ставит access (15 мин — короткоживущий) и refresh (7 дней) в httpOnly куки.
   * Access также возвращается в теле ответа для обратной совместимости со
   * старым фронтом, читающим его из JSON; новый фронт может полагаться на куку.
   */
  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const opts = this.cookieOptions();
    response.cookie('accessToken', accessToken, {
      ...opts,
      maxAge: 15 * 60 * 1000, // 15 минут
    });
    response.cookie('refreshToken', refreshToken, {
      ...opts,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });
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
