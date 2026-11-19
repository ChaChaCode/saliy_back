import { paymentMethodLabel } from './payment-label';

describe('paymentMethodLabel', () => {
  it('Яндекс Пэй с деталью', () => {
    expect(paymentMethodLabel('YANDEX_PAY', 'SPLIT')).toBe('Яндекс Пэй · Сплит');
    expect(paymentMethodLabel('YANDEX_PAY', 'CARD')).toBe('Яндекс Пэй · карта');
    expect(paymentMethodLabel('YANDEX_PAY', 'SBP')).toBe('Яндекс Пэй · СБП');
  });

  it('без детали и незнакомые значения', () => {
    expect(paymentMethodLabel('YANDEX_PAY', null)).toBe('Яндекс Пэй');
    expect(paymentMethodLabel('CARD_ONLINE')).toBe('Т-Банк (карта)');
    expect(paymentMethodLabel('YANDEX_PAY', 'NEW_TYPE')).toBe('Яндекс Пэй · NEW_TYPE');
    expect(paymentMethodLabel(null)).toBe('');
  });
});
