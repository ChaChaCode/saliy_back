import { validateProductPrices } from './product-price.util';

describe('product price validation', () => {
  it('accepts exact current and old prices without rounding to a percentage', () => {
    expect(() => validateProductPrices({ price: 6377, oldPrice: 7900 })).not.toThrow();
  });
  it('accepts removing the old price and existing percentage discounts', () => {
    expect(() => validateProductPrices({ price: 7900, oldPrice: null, discount: 15 })).not.toThrow();
  });
  it.each([0, 6000, 6377, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid old price %s', oldPrice => {
    expect(() => validateProductPrices({ price: 6377, oldPrice })).toThrow();
  });
  it('prevents applying a second discount to an explicit current price', () => {
    expect(() => validateProductPrices({ price: 6377, oldPrice: 7900, discount: 15 })).toThrow();
  });
});
