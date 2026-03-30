import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { S3UrlInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Подключаем Winston как главный логгер приложения
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Включаем CORS
  const allowedOrigins = [
    'http://localhost:3000', // Фронтенд в разработке
    'http://localhost:3001', // Админка в разработке
    'https://saliy-shop.ru', // Production основной сайт
    'https://www.saliy-shop.ru', // Production с www
    'https://admin.saliy-shop.ru', // Production админка
    'https://saliyclothes.vercel.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, из Postman или серверные запросы)
      if (!origin || allowedOrigins.includes(origin)) {
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

  // Глобальный interceptor для преобразования относительных путей в S3 URL
  app.useGlobalInterceptors(new S3UrlInterceptor());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // Логируем через Winston
  app.get(WINSTON_MODULE_NEST_PROVIDER).log(`Приложение запущено на порту ${port}`, 'Bootstrap');
}
bootstrap();
