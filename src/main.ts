import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { raw } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { S3UrlInterceptor, LoggingInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Включаем CORS.
  // Список разрешённых origin берётся из CORS_ORIGINS (через запятую).
  // Если переменная не задана — используется дефолтный список ниже.
  const defaultOrigins = [
    'http://localhost:3000', // Фронтенд в разработке
    'http://localhost:3001', // Админка в разработке
    'http://localhost:5173', // Vite dev server
  ];
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((o) => o.trim().replace(/\/+$/, '')) // убираем пробелы и хвостовой слеш
        .filter(Boolean)
    : defaultOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, из Postman или серверные запросы)
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalized)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true, // Разрешаем отправку cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Подключаем cookie parser
  app.use(cookieParser());

  // Yandex Pay webhook приходит как application/octet-stream (JWT внутри) — нужен raw-парсер.
  // Применяем точечно к webhook-маршруту, чтобы не сломать остальные эндпоинты.
  app.use(
    '/api/payment/yandex/webhook',
    raw({ type: 'application/octet-stream', limit: '1mb' }),
  );

  // Раздача статических файлов (загруженные изображения)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Глобальный префикс для всех роутов
  app.setGlobalPrefix('api');

  // Глобальная валидация
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Удаляет поля, которых нет в DTO
      forbidNonWhitelisted: true, // Выбрасывает ошибку при наличии лишних полей
      transform: true, // Автоматически преобразует типы
    }),
  );

  // Глобальные interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(), // Логирование HTTP запросов
    new S3UrlInterceptor(), // Преобразование относительных путей в S3 URL
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Приложение запущено на порту ${port}`);
}
bootstrap();
