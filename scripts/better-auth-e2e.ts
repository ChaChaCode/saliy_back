/* Проверочный сценарий Better Auth: настоящий NestJS + наш модуль и guard'ы,
   хранилище в памяти, письмо перехватывается.
   Запуск: npx ts-node --transpile-only -P tsconfig.json scripts/better-auth-e2e.ts
   (Jest не подходит: Better Auth поставляется только как ES-модули). */
process.env.BETTER_AUTH_SECRET = 'e2e-secret-e2e-secret-e2e-secret-0123';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';

import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Module,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';

const SRC = '../src';
const { createBetterAuth } = require(`${SRC}/auth/better-auth`);
const { CustomerAuthGuard } = require(`${SRC}/auth/guards/customer-auth.guard`);
const { OptionalCustomerAuthGuard } = require(`${SRC}/auth/guards/optional-customer-auth.guard`);
const { AuthService } = require(`${SRC}/auth/auth.service`);

const sentCodes: { email: string; code: string }[] = [];
const fakeEmail = {
  sendVerificationCode: async (email: string, code: string) => {
    sentCodes.push({ email, code });
  },
};
const linkCalls: any[] = [];
const fakePrisma = {
  user: { findUnique: async () => ({ email: 'buyer@test.local' }) },
  order: {
    updateMany: async (args: any) => {
      linkCalls.push(args);
      return { count: 2 };
    },
  },
};
const db = { user: [], session: [], account: [], verification: [] };

const fakeAuthService = {
  validateUser: async (id: string) => ({ id, email: 'buyer@test.local', firstName: 'Тест' }),
};

@Controller('t')
class TestController {
  @Get('me')
  @UseGuards(CustomerAuthGuard)
  me(@Req() req: any) {
    return req.user;
  }
  @Get('optional')
  @UseGuards(OptionalCustomerAuthGuard)
  optional(@Req() req: any) {
    return { user: req.user ?? null };
  }
  @Get('public')
  publicRoute() {
    return { ok: true };
  }
  @Post('echo')
  echo(@Body() body: any) {
    return { body };
  }
}

@Module({
  imports: [
    // Та же форма настройки, что в app.module.ts (forRootAsync).
    BetterAuthModule.forRootAsync({
      disableGlobalAuthGuard: true,
      useFactory: () => ({
        auth: createBetterAuth(fakePrisma, fakeEmail, memoryAdapter(db)),
        disableTrustedOriginsCors: true,
      }),
    }),
  ],
  controllers: [TestController],
  providers: [{ provide: AuthService, useValue: fakeAuthService }],
})
class TestModule {}

const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);
const cookieHeader = (res: any) =>
  ((res.headers['set-cookie'] as unknown as string[]) || []).map((c) => c.split(';')[0]).join('; ');

(async () => {
  const app = await NestFactory.create(TestModule, { bodyParser: false, logger: ['error'] });
  app.setGlobalPrefix('api');
  await app.init();
  const http = app.getHttpServer();
  const origin = 'http://localhost:3000';
  const email = 'buyer@test.local';

  // 0. Публичный маршрут без входа открыт (глобальная проверка выключена)
  let r0 = await request(http).get('/api/t/public');
  check('публичный маршрут без входа → 200', r0.status === 200, String(r0.status));

  // 1. Отправка кода
  let r = await request(http)
    .post('/api/session/email-otp/send-verification-otp')
    .set('Origin', origin)
    .send({ email, type: 'sign-in' });
  check('send OTP → 200', r.status === 200, `${r.status} ${JSON.stringify(r.body)}`);
  const code = sentCodes.at(-1)?.code ?? '';
  check('код из 4 цифр ушёл в письмо', /^\d{4}$/.test(code), code.replace(/./g, '*'));
  check('код в базе не открытым текстом', !JSON.stringify(db.verification).includes(code));

  // 2. Неверный код
  r = await request(http).post('/api/session/sign-in/email-otp').set('Origin', origin)
    .send({ email, otp: code === '0000' ? '1111' : '0000' });
  check('неверный код → ошибка', r.status >= 400, String(r.status));

  // 3. Верный код
  r = await request(http).post('/api/session/sign-in/email-otp').set('Origin', origin)
    .send({ email, otp: code });
  check('вход по коду → 200', r.status === 200, `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  const cookies = cookieHeader(r);
  const setCookie = ((r.headers['set-cookie'] as unknown as string[]) || []).join(' | ');
  check('кука сессии httpOnly + Secure', /HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie), setCookie.slice(0, 160));
  const rawToken: string = r.body?.token ?? '';
  const cookieName = cookies.split('=')[0];
  check('кука = токен + подпись', cookies.includes(`${rawToken}.`), cookieName);
  check('гостевые заказы привязаны', linkCalls.length === 1 && linkCalls[0].where.email === email, JSON.stringify(linkCalls[0] ?? {}));
  check('новый покупатель: почта подтверждена', (db.user as any[])[0]?.emailVerified === true);

  // 3b. Токен из тела ответа без подписи не даёт входа
  r = await request(http).get('/api/t/me').set('Cookie', `${cookieName}=${rawToken}`);
  check('токен из тела без подписи → 401', r.status === 401, String(r.status));
  r = await request(http).get('/api/t/me').set('Authorization', `Bearer ${rawToken}`);
  check('токен из тела в Authorization → 401', r.status === 401, String(r.status));

  // 4. Наш guard принимает сессию Better Auth
  r = await request(http).get('/api/t/me').set('Cookie', cookies);
  check('CustomerAuthGuard + сессия → 200, полный профиль', r.status === 200 && r.body.firstName === 'Тест', `${r.status} ${JSON.stringify(r.body)}`);
  r = await request(http).get('/api/t/me');
  check('CustomerAuthGuard без входа → 401', r.status === 401, String(r.status));
  r = await request(http).get('/api/t/optional');
  check('OptionalCustomerAuthGuard без входа → 200, user пустой', r.status === 200 && !r.body.user, JSON.stringify(r.body));
  r = await request(http).get('/api/t/optional').set('Cookie', cookies);
  check('OptionalCustomerAuthGuard с сессией → user', r.body.user?.firstName === 'Тест');

  // 5. Разбор тела у обычных маршрутов после bodyParser:false
  r = await request(http).post('/api/t/echo').send({ a: 1, s: 'тест' });
  check('JSON-тело обычного POST разбирается', r.body?.body?.a === 1 && r.body.body.s === 'тест', JSON.stringify(r.body));
  r = await request(http).post('/api/t/echo').type('form').send('a=1&b=x');
  check('urlencoded-тело разбирается', r.body?.body?.b === 'x', JSON.stringify(r.body));

  // 6. /api/auth/* не перехватывается Better Auth (там наши me/profile)
  r = await request(http).get('/api/auth/me');
  check('/api/auth/me не занят Better Auth (404 в тестовом app)', r.status === 404, String(r.status));

  // 7. Выход
  r = await request(http).post('/api/session/sign-out').set('Origin', origin).set('Cookie', cookies).send({});
  check('выход → 200', r.status === 200, String(r.status));
  r = await request(http).get('/api/t/me').set('Cookie', cookies);
  check('после выхода сессия недействительна → 401', r.status === 401, String(r.status));

  // 8. Ограничение частоты отправки кода (3 в минуту с IP)
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    const x = await request(http).post('/api/session/email-otp/send-verification-otp')
      .set('Origin', origin).set('X-Real-IP', '10.0.0.9').send({ email: `r${i}@test.local`, type: 'sign-in' });
    statuses.push(x.status);
  }
  check('4-я отправка кода за минуту → 429', statuses[3] === 429, statuses.join(','));

  // 9. Чужой Origin не может войти
  r = await request(http).post('/api/session/email-otp/send-verification-otp')
    .set('Origin', 'https://evil.example').set('X-Real-IP', '10.0.0.10').send({ email, type: 'sign-in' });
  check('запрос с чужого Origin отклонён', r.status === 403, String(r.status));

  await app.close();
  for (const [n, ok, info] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '  → ' + info}`);
  const failed = results.filter((x) => !x[1]).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
