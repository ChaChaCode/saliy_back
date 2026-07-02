import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { DeliveryService } from '../delivery/delivery.service';
import { UpdateDeliveryLocationDto } from './dto/update-delivery-location.dto';
import { S3StorageService } from '../common/storage/s3-storage.service';
import { getAccessSecret } from '../common/utils/jwt-secrets';
import * as crypto from 'crypto';

/**
 * Дата рождения хранится в UTC midnight. Возвращаем фронту строку DD.MM.YYYY,
 * чтобы он не парсил ISO и не путался с часовыми поясами.
 */
export function formatBirthdate(date: Date | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private deliveryService: DeliveryService,
    private s3: S3StorageService,
  ) {}

  // Максимум неудачных попыток ввода кода на email до его инвалидации.
  private static readonly MAX_CODE_ATTEMPTS = 5;

  private generateCode(): string {
    // Криптостойкий 6-значный код (100000–999999). Раньше был 4-значный на
    // Math.random() — предсказуемый и всего 9000 комбинаций, перебираемый.
    return crypto.randomInt(100000, 1000000).toString();
  }

  /** Подмешать birthdateFormatted к user-объекту перед отдачей. */
  private withFormattedBirthdate<T extends { birthdate?: Date | null }>(user: T): T & { birthdateFormatted: string | null } {
    return { ...user, birthdateFormatted: formatBirthdate(user?.birthdate) };
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
    // Берём последний активный код для этого email (не сам код из запроса —
    // сравнение делаем ниже, чтобы считать неудачные попытки).
    const active = await this.prisma.verificationCode.findFirst({
      where: {
        email,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!active) {
      throw new UnauthorizedException('Неверный или истекший код');
    }

    // Слишком много неудачных попыток → инвалидируем код (защита от перебора).
    if (active.attempts >= AuthService.MAX_CODE_ATTEMPTS) {
      await this.prisma.verificationCode.update({
        where: { id: active.id },
        data: { verified: true },
      });
      throw new UnauthorizedException(
        'Превышено число попыток. Запросите новый код.',
      );
    }

    // Неверный код → атомарно инкрементим счётчик попыток и отказываем.
    if (active.code !== code) {
      await this.prisma.verificationCode.update({
        where: { id: active.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Неверный или истекший код');
    }

    // Код верный → атомарно помечаем использованным. updateMany с условием
    // verified:false гарантирует, что параллельные запросы не пройдут дважды
    // (закрывает race condition — код одноразовый).
    const used = await this.prisma.verificationCode.updateMany({
      where: { id: active.id, verified: false },
      data: { verified: true },
    });
    if (used.count === 0) {
      throw new UnauthorizedException('Неверный или истекший код');
    }

    // Находим или создаем пользователя
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { email },
      });
    }

    // Привязываем гостевые заказы, оформленные на эту (теперь подтверждённую)
    // почту, к пользователю — чтобы они появились в его «Моих заказах».
    // Email подтверждён кодом, поэтому привязка безопасна.
    try {
      const linked = await this.prisma.order.updateMany({
        where: { email, userId: null },
        data: { userId: user.id },
      });
      if (linked.count > 0) {
        this.logger.log(
          `Привязано гостевых заказов к пользователю ${user.id} (${email}): ${linked.count}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Не удалось привязать гостевые заказы для ${email}: ${error.message}`,
      );
      // Не падаем — вход важнее
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
      secret: getAccessSecret(),
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        avatarUrl: true,
        birthdate: true,
        socialContact: true,
        street: true,
        apartment: true,
        postalCode: true,
        deliveryType: true,
        cdekCityCode: true,
        cdekCountryCode: true,
        cdekRegionCode: true,
        cdekPickupPointCode: true,
        cityName: true,
        countryName: true,
        regionName: true,
        deliveryCountryCode: true,
        fullAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user ? this.withFormattedBirthdate(user) : null;
  }

  /**
   * Загрузить аватар пользователя в S3.
   * Хранится по ключу avatars/{userId}-{timestamp}.{ext}
   */
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // Удаляем старый аватар из S3, если был
    if (user?.avatarUrl) {
      await this.s3.delete(user.avatarUrl);
    }

    // Загружаем новый
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `avatars/${userId}-${Date.now()}.${ext}`;
    await this.s3.upload(key, file.buffer, file.mimetype);

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: key },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
  }

  /**
   * Удалить аватар пользователя
   */
  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user?.avatarUrl) {
      throw new BadRequestException('Аватар не установлен');
    }

    await this.s3.delete(user.avatarUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return { success: true };
  }

  async updateProfile(userId: string, data: any) {
    // Если обновляется дата рождения - проверяем ограничение
    if (data.birthdate) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { birthdate: true, birthdateUpdatedAt: true },
      });

      // Если дата рождения уже установлена, проверяем можно ли обновить
      if (user?.birthdate && user?.birthdateUpdatedAt) {
        const now = new Date();
        const lastUpdate = new Date(user.birthdateUpdatedAt);
        const oneYearAgo = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate(),
        );

        // Если с последнего обновления прошло меньше года - запрещаем
        if (lastUpdate > oneYearAgo) {
          throw new BadRequestException(
            'Дату рождения можно изменить только раз в год',
          );
        }
      }

      // Преобразуем строку даты из формата DD.MM.YYYY в Date.
      // Используем Date.UTC, чтобы не зависеть от TZ сервера — в БД всегда
      // попадает чистая дата YYYY-MM-DD без сдвигов на полдня.
      const [day, month, year] = data.birthdate.split('.').map(Number);
      data.birthdate = new Date(Date.UTC(year, month - 1, day));

      // Проверяем валидность даты + разумный диапазон года
      const currentYear = new Date().getUTCFullYear();
      if (
        isNaN(data.birthdate.getTime()) ||
        year < 1900 ||
        year > currentYear ||
        data.birthdate.getUTCFullYear() !== year ||
        data.birthdate.getUTCMonth() + 1 !== month ||
        data.birthdate.getUTCDate() !== day
      ) {
        throw new BadRequestException('Некорректная дата рождения');
      }

      // Обновляем birthdateUpdatedAt при изменении birthdate
      data.birthdateUpdatedAt = new Date();
    }

    const updated = await this.prisma.user.update({
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
        avatarUrl: true,
        birthdate: true,
        socialContact: true,
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
    return this.withFormattedBirthdate(updated);
  }

  async updateDeliveryLocation(userId: string, dto: UpdateDeliveryLocationDto) {
    // Получаем текущего пользователя
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      throw new BadRequestException('Пользователь не найден');
    }

    // Объект для обновления
    const updateData: any = {};

    // Если меняется тип доставки, очищаем поля другого типа
    if (dto.deliveryType && dto.deliveryType !== currentUser.deliveryType) {
      updateData.deliveryType = dto.deliveryType;

      if (dto.deliveryType === 'CDEK') {
        // Очищаем поля POST
        updateData.deliveryCountryCode = null;
        updateData.fullAddress = null;
        updateData.postalCode = null;
      } else if (dto.deliveryType === 'POST') {
        // Очищаем поля CDEK
        updateData.cdekCityCode = null;
        updateData.cdekCountryCode = null;
        updateData.cdekRegionCode = null;
        updateData.cdekPickupPointCode = null;
        updateData.cityName = null;
        updateData.regionName = null;
      }
    }

    // === Обработка CDEK полей ===

    // Если указан город CDEK
    if (dto.cdekCityCode !== undefined) {
      // Ищем город в обеих странах CDEK (RU и BY)
      let city: any = null;

      // Сначала ищем в России
      const citiesRU = await this.deliveryService.getCdekCities('RU', undefined, undefined);
      city = citiesRU.cities.find((c) => c.code === dto.cdekCityCode);

      // Если не нашли в России, ищем в Беларуси
      if (!city) {
        const citiesBY = await this.deliveryService.getCdekCities('BY', undefined, undefined);
        city = citiesBY.cities.find((c) => c.code === dto.cdekCityCode);
      }

      if (!city) {
        throw new BadRequestException('Город не найден в CDEK');
      }

      updateData.cdekCityCode = city.code;
      updateData.cdekCountryCode = city.countryCode;
      updateData.cdekRegionCode = city.regionCode;
      updateData.cityName = city.name;
      updateData.countryName = city.countryCode === 'RU' ? 'Россия' : 'Беларусь';
      updateData.regionName = city.region;
    }

    // Если указан пункт выдачи CDEK
    if (dto.cdekPickupPointCode !== undefined) {
      // Проверяем что город уже выбран
      const cityCode = dto.cdekCityCode || currentUser.cdekCityCode;

      if (!cityCode) {
        throw new BadRequestException(
          'Сначала выберите город (cdekCityCode)',
        );
      }

      const pickupPoints = await this.deliveryService.getCdekPickupPoints(cityCode);
      const pickupPoint = pickupPoints.points.find((p) => p.code === dto.cdekPickupPointCode);

      if (!pickupPoint) {
        throw new BadRequestException('Пункт выдачи не найден');
      }

      updateData.cdekPickupPointCode = dto.cdekPickupPointCode;
    }

    // === Обработка POST полей ===

    // Если указана страна для почтовой доставки
    if (dto.deliveryCountryCode !== undefined) {
      const countryInfo = this.deliveryService.getCountryInfo(dto.deliveryCountryCode, 'ru');

      if (!countryInfo) {
        throw new BadRequestException('Страна не найдена');
      }

      updateData.deliveryCountryCode = dto.deliveryCountryCode;
      updateData.countryName = countryInfo.name;
    }

    // Полный адрес
    if (dto.fullAddress !== undefined) {
      updateData.fullAddress = dto.fullAddress;
    }

    // Почтовый индекс
    if (dto.postalCode !== undefined) {
      updateData.postalCode = dto.postalCode;
    }

    // Обновляем пользователя
    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        deliveryType: true,
        cdekCityCode: true,
        cdekCountryCode: true,
        cdekRegionCode: true,
        cdekPickupPointCode: true,
        cityName: true,
        countryName: true,
        regionName: true,
        postalCode: true,
        deliveryCountryCode: true,
        fullAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
