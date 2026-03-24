import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Включаем CORS
  const allowedOrigins = [
    'http://localhost:3000', // Фронтенд в разработке
    'http://localhost:3001', // Админка в разработке
    'https://saliy-shop.ru', // Production основной сайт
    'https://www.saliy-shop.ru', // Production с www
    'https://admin.saliy-shop.ru', // Production админка
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
