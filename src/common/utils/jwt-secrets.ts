/**
 * Единая точка получения JWT-секретов.
 *
 * Секреты ОБЯЗАТЕЛЬНЫ и должны быть достаточно длинными. Раньше по коду был
 * фолбэк вида `process.env.JWT_ACCESS_SECRET || 'access-secret-key'`: если
 * переменная окружения не подхватывалась (а при переносе .env такое уже
 * случалось), приложение молча начинало подписывать токены публично известной
 * строкой из исходников — и кто угодно мог подделать токен пользователя или
 * SUPER_ADMIN. Теперь при отсутствии/слабости секрета приложение падает на
 * старте (fail-fast), а не работает с угадываемым ключом.
 */

const MIN_LENGTH = 32;

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length < MIN_LENGTH) {
    throw new Error(
      `Переменная окружения ${name} не задана или короче ${MIN_LENGTH} символов. ` +
        `Задай криптостойкий секрет (openssl rand -hex 32). Запуск без него небезопасен.`,
    );
  }
  return value;
}

export function getAccessSecret(): string {
  return requireSecret('JWT_ACCESS_SECRET');
}

export function getAdminSecret(): string {
  return requireSecret('JWT_ADMIN_SECRET');
}
