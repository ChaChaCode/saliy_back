import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Put,
  Delete,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateDeliveryLocationDto } from './dto/update-delivery-location.dto';
import { CustomerAuthGuard } from './guards/customer-auth.guard';

// Вход и выход — Better Auth (/api/session/*, см. src/auth/better-auth.ts).
// Здесь профиль покупателя: данные, адрес доставки, аватар.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(CustomerAuthGuard)
  async getProfile(@Req() request: any) {
    return request.user;
  }

  @Put('profile')
  @UseGuards(CustomerAuthGuard)
  async updateProfile(
    @Req() request: any,
    @Body(ValidationPipe) dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(request.user.id, dto);
  }

  @Put('delivery-location')
  @UseGuards(CustomerAuthGuard)
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
  @UseGuards(CustomerAuthGuard)
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
  @UseGuards(CustomerAuthGuard)
  async removeAvatar(@Req() request: any) {
    return this.authService.removeAvatar(request.user.id);
  }
}
