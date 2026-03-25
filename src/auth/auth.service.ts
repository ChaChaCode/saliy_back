import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  private generateCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async sendVerificationCode(email: string): Promise<void> {
    // Проверяем последний отправленный код для этого email
    const lastCode = await this.prisma.verificationCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    // Если код был отправлен менее минуты назад, возвращаем ошибку
    if (lastCode) {
      const timeSinceLastCode = Date.now() - lastCode.createdAt.getTime();
      const oneMinute = 60 * 1000; // 1 минута в миллисекундах

      if (timeSinceLastCode < oneMinute) {
        const secondsLeft = Math.ceil((oneMinute - timeSinceLastCode) / 1000);
        throw new BadRequestException(
          `Код уже был отправлен. Повторная отправка возможна через ${secondsLeft} секунд`,
        );
      }
    }

    // Генерируем 6-значный код
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    // Инвалидируем старые коды
    await this.prisma.verificationCode.updateMany({
      where: { email, verified: false },
      data: { verified: true },
    });

    // Создаем новый код
    await this.prisma.verificationCode.create({
      data: {
        code,
        email,
        expiresAt,
      },
    });

    // Отправляем код на email
    await this.emailService.sendVerificationCode(email, code);
  }

  async verifyCode(
    email: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Ищем код
    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        verified: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!verificationCode) {
      throw new UnauthorizedException('Неверный или истекший код');
    }

    // Помечаем код как использованный
    await this.prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { verified: true },
    });

    // Находим или создаем пользователя
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { email },
      });
    }

    // Генерируем токены
    return this.generateTokens(user.id, user.email);
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email };

    // Access token на 15 минут
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'access-secret-key',
      expiresIn: '15m',
    });

    // Refresh token на 7 дней
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Сохраняем refresh token в БД
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Ищем refresh token в БД
    const tokenData = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenData || tokenData.expiresAt < new Date()) {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    // Удаляем старый refresh token
    await this.prisma.refreshToken.delete({
      where: { id: tokenData.id },
    });

    // Генерируем новые токены
    return this.generateTokens(tokenData.user.id, tokenData.user.email);
  }

  async logout(refreshToken: string): Promise<void> {
    // Удаляем refresh token из БД
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        street: true,
        apartment: true,
        postalCode: true,
        cdekCityCode: true,
        cdekCountryCode: true,
        cdekRegionCode: true,
        cityName: true,
        countryName: true,
        regionName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(userId: string, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        street: true,
        apartment: true,
        postalCode: true,
        cdekCityCode: true,
        cdekCountryCode: true,
        cdekRegionCode: true,
        cityName: true,
        countryName: true,
        regionName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateDeliveryLocation(userId: string, cdekCityCode: number) {
    // Здесь должна быть интеграция с CDEK API для получения информации о городе
    // Пока просто сохраняем код города
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        cdekCityCode,
        // TODO: Получить из CDEK API:
        // cdekCountryCode, cdekRegionCode, cityName, countryName, regionName
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        street: true,
        apartment: true,
        postalCode: true,
        cdekCityCode: true,
        cdekCountryCode: true,
        cdekRegionCode: true,
        cityName: true,
        countryName: true,
        regionName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
