/**
 * Порядок размеров для отдачи наружу. PostgreSQL хранит stock в jsonb, а jsonb
 * переставляет ключи (сначала короткие, потом по алфавиту): из базы приходит
 * L, M, S, XL, XS. Витрина и админка выводят размеры в порядке ключей, поэтому
 * перед ответом ключи выстраиваются по этой шкале; неизвестные — в конце по алфавиту.
 * Числовые размеры (например «42») объект JavaScript всегда ставит первыми.
 */
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'OS'];

const rank = (size: string) => {
  const i = SIZE_ORDER.indexOf(size.toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
};

export function orderSizes<T>(stock: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(stock).sort(
      ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b),
    ),
  );
}
