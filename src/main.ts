import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { S3UrlInterceptor, LoggingInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // За nginx (терминирует TLS). Без trust proxy req.secure/HSTS вычисляются
  // неверно, а req.ip берёт адрес nginx (127.0.0.1) вместо реального клиента.
  // 'loopback' — доверяем только локальному прокси, X-Forwarded-* от внешних
  // клиентов игнорируются (нельзя подделать IP для rate-limit/блокировок).
  app.set('trust proxy', 'loopback');

  // Скрываем X-Powered-By: Express (не раскрываем стек).
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Security-заголовки для API. CSP отключаем — API отдаёт JSON, а CSP для
  // страниц фронта/админки задаётся в nginx. HSTS ставит nginx на всех доменах
  // (единая политика), поэтому здесь его тоже выключаем, чтобы не дублировать.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      strictTransportSecurity: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Gzip-сжатие ответов API (JSON). Статику фронта/админки сжимает nginx.
  app.use(compression());

  // API data must be fresh after writes; static assets keep their own policy.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

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
