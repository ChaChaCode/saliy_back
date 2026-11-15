import { buildYandexCart } from './yandex-pay.cart';

const sumItems = (cart: ReturnType<typeof buildYandexCart>) =>
  cart.items.reduce((sum, item) => sum + Math.round(Number(item.total) * 100), 0);

const twoDecimals = (cart: ReturnType<typeof buildYandexCart>) =>
  cart.items.every((item) => {
    const unitKop = (Number(item.total) * 100) / Number(item.quantity.count);
    return Math.abs(unitKop - Math.round(unitKop)) < 1e-6;
  });

describe('buildYandexCart', () => {
  it('без промокода — строки как есть, доставка отдельной позицией', () => {
    const cart = buildYandexCart(
      [{ productId: '7-M', title: 'Пуховик, M', quantity: 2, totalKop: 3580000 }],
      0,
      45000,
      3625000,
    );
    expect(cart.items).toEqual([
      { productId: '7-M', title: 'Пуховик, M', quantity: { count: '2' }, total: '35800.00' },
      { productId: 'delivery', title: 'Доставка', quantity: { count: '1' }, total: '450.00' },
    ]);
    expect(cart.total.amount).toBe('36250.00');
  });

  it('скидка раскладывается по строкам, сумма позиций равна итогу', () => {
    const cart = buildYandexCart(
      [
        { productId: '1-S', title: 'A', quantity: 3, totalKop: 300000 },
        { productId: '2-M', title: 'B', quantity: 1, totalKop: 179000 },
      ],
      100,
      0,
      478900,
    );
    expect(sumItems(cart)).toBe(478900);
    expect(cart.total.amount).toBe('4789.00');
    expect(twoDecimals(cart)).toBe(true);
  });

  it('строка, которая не делится на количество, режется на две с разными productId', () => {
    const cart = buildYandexCart(
      [{ productId: '1-S', title: 'A', quantity: 3, totalKop: 1000 }],
      0,
      0,
      1000,
    );
    expect(cart.items.map((i) => [i.productId, i.quantity.count, i.total])).toEqual([
      ['1-S', '2', '6.66'],
      ['1-S:1', '1', '3.34'],
    ]);
    expect(new Set(cart.items.map((i) => i.productId)).size).toBe(cart.items.length);
  });

  it('бесплатная доставка не добавляет позицию', () => {
    const cart = buildYandexCart(
      [{ productId: '1-S', title: 'A', quantity: 1, totalKop: 100000 }],
      0,
      0,
      100000,
    );
    expect(cart.items).toHaveLength(1);
  });

  it('падает, если сумма не сходится с заказом', () => {
    expect(() =>
      buildYandexCart([{ productId: '1', title: 'A', quantity: 1, totalKop: 100 }], 0, 0, 101),
    ).toThrow();
  });
});
