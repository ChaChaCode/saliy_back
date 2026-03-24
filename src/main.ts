import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Включаем CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // Разрешаем отправку cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Подключаем cookie parser
  app.use(cookieParser());

  // Глобальная валидация
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Удаляет поля, которых нет в DTO
      forbidNonWhitelisted: true, // Выбрасывает ошибку при наличии лишних полей
      transform: true, // Автоматически преобразует типы
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Приложение запущено на порту ${process.env.PORT ?? 3000}`);
}
bootstrap();
