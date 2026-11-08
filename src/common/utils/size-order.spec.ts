import { orderSizes } from './size-order';

describe('orderSizes', () => {
  it('puts sizes in XS..XL order regardless of jsonb key order', () => {
    const fromDb = { L: 40, M: 59, S: 20, XL: 20, XS: 10 };
    expect(Object.keys(orderSizes(fromDb))).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
    ]);
  });

  it('keeps values and sends unknown sizes to the end', () => {
    const result = orderSizes({ ONE: 1, M: 2, OS: 3, xs: 4 });
    expect(Object.keys(result)).toEqual(['xs', 'M', 'OS', 'ONE']);
    expect(result.M).toBe(2);
  });
});
