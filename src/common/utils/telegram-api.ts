const DEFAULT_TELEGRAM_API = 'https://api.telegram.org';

/**
 * Адрес Telegram Bot API. С сервера в РФ api.telegram.org открывается
 * нестабильно, поэтому запросы можно пустить через свой релей (Cloudflare
 * Worker): TELEGRAM_API_BASE = https://<воркер>.workers.dev/<секрет>.
 * Путь после хоста (секрет) разрешён. Без переменной или с некорректным
 * значением — напрямую в api.telegram.org.
 */
export function telegramApiBase(): string {
  const raw = (process.env.TELEGRAM_API_BASE || '').trim().replace(/\/+$/, '');
  if (!raw) return DEFAULT_TELEGRAM_API;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.search || url.hash) {
      return DEFAULT_TELEGRAM_API;
    }
    return raw;
  } catch {
    return DEFAULT_TELEGRAM_API;
  }
}

/** Таймаут обычного запроса в Telegram: без него сбой держит запрос ~2 минуты. */
export const TELEGRAM_TIMEOUT_MS = 10_000;
