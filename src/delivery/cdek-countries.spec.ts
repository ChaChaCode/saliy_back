import { cdekCountries, deliveryTypesFor, isCdekCountry } from './cdek-countries';

describe('Страны СДЭК', () => {
  const prev = process.env.CDEK_COUNTRIES;
  afterEach(() => {
    process.env.CDEK_COUNTRIES = prev;
  });

  it('по умолчанию — Россия, Беларусь и Казахстан', () => {
    delete process.env.CDEK_COUNTRIES;
    expect(cdekCountries()).toEqual(['RU', 'BY', 'KZ']);
    expect(deliveryTypesFor('KZ')).toEqual(['CDEK_PICKUP', 'STANDARD']);
    expect(deliveryTypesFor('kz')).toEqual(['CDEK_PICKUP', 'STANDARD']);
    expect(isCdekCountry('KAZ')).toBe(true);
    expect(isCdekCountry('RUS')).toBe(true);
  });

  it('в остальных странах только почта', () => {
    delete process.env.CDEK_COUNTRIES;
    expect(deliveryTypesFor('DE')).toEqual(['STANDARD']);
    expect(deliveryTypesFor(undefined)).toEqual(['STANDARD']);
    expect(isCdekCountry('')).toBe(false);
  });

  it('список переопределяется CDEK_COUNTRIES, мусор игнорируется', () => {
    process.env.CDEK_COUNTRIES = 'ru, by, kz, KG, AM, xxx';
    expect(cdekCountries()).toEqual(['RU', 'BY', 'KZ', 'KG', 'AM']);
    expect(isCdekCountry('KGZ')).toBe(true);
    process.env.CDEK_COUNTRIES = 'xxx';
    expect(cdekCountries()).toEqual(['RU', 'BY', 'KZ']);
  });
});
