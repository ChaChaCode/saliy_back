import { telegramApiBase } from './telegram-api';

describe('telegramApiBase', () => {
  const prev = process.env.TELEGRAM_API_BASE;
  afterEach(() => {
    process.env.TELEGRAM_API_BASE = prev;
  });

  it('без переменной — напрямую в api.telegram.org', () => {
    delete process.env.TELEGRAM_API_BASE;
    expect(telegramApiBase()).toBe('https://api.telegram.org');
  });

  it('адрес воркера с секретом в пути разрешён, хвостовой слэш убирается', () => {
    process.env.TELEGRAM_API_BASE = 'https://tg.example.workers.dev/abcdefghijklmnopqrstuvwxyz_-12/';
    expect(telegramApiBase()).toBe(
      'https://tg.example.workers.dev/abcdefghijklmnopqrstuvwxyz_-12',
    );
  });

  it('http, query и мусор — откат на api.telegram.org', () => {
    for (const bad of ['http://tg.example.dev/s', 'https://tg.example.dev/s?x=1', 'not a url']) {
      process.env.TELEGRAM_API_BASE = bad;
      expect(telegramApiBase()).toBe('https://api.telegram.org');
    }
  });
});
