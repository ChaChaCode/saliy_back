/**
 * Страны, где доступен самовывоз из ПВЗ СДЭК (CDEK_PICKUP). Почта (STANDARD)
 * доступна везде.
 *
 * По умолчанию — Россия, Беларусь и Казахстан. Все три в Таможенном союзе:
 * для СДЭК отправка из России туда не международная, накладная создаётся
 * обычная, без инвойса и паспортных данных получателя.
 * Переопределяется переменной CDEK_COUNTRIES (коды ISO через запятую).
 */
const DEFAULT_CDEK_COUNTRIES = ['RU', 'BY', 'KZ'];

// Трёхбуквенные коды, которые иногда присылает клиент.
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  RUS: 'RU',
  BLR: 'BY',
  KAZ: 'KZ',
  KGZ: 'KG',
  ARM: 'AM',
};

export function cdekCountries(): string[] {
  const raw = process.env.CDEK_COUNTRIES?.trim();
  if (!raw) return DEFAULT_CDEK_COUNTRIES;
  const list = raw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  return list.length ? list : DEFAULT_CDEK_COUNTRIES;
}

export function isCdekCountry(countryCode: string | undefined | null): boolean {
  if (!countryCode) return false;
  const code = countryCode.trim().toUpperCase();
  return cdekCountries().includes(ALPHA3_TO_ALPHA2[code] ?? code);
}

export function deliveryTypesFor(countryCode: string | undefined | null) {
  return isCdekCountry(countryCode)
    ? ['CDEK_PICKUP', 'STANDARD']
    : ['STANDARD'];
}
