/**
 * Опции для httpOnly auth-кук, управляемые через переменную окружения.
 *
 * COOKIE_SAMESITE задаёт политику SameSite:
 *   - lax (по умолчанию) — фронт и API на одном сайте (saliystudio.com);
 *     строже и безопаснее.
 *   - none — фронт на другом домене (cross-site, напр. Vercel). Браузер
 *     отправит куку на cross-site запросы. Требует Secure=true (ставится
 *     автоматически).
 *   - strict — самый строгий, кука не уходит ни на какие переходы со
 *     стороннего сайта.
 *
 * Переключается без правки кода: меняешь COOKIE_SAMESITE в .env и
 * перезапускаешь приложение.
 */
export type SameSiteOption = 'lax' | 'none' | 'strict';

export function getCookieSameSite(): SameSiteOption {
  const raw = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (raw === 'none' || raw === 'strict' || raw === 'lax') {
    return raw;
  }
  return 'lax';
}

/**
 * Базовые опции auth-куки. secure всегда true (нужно для SameSite=None и
 * корректно при HTTPS-проде). При SameSite=None браузер требует Secure —
 * поэтому secure=true безопасно для всех режимов.
 */
export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: getCookieSameSite(),
    path: '/',
  };
}
