import { CartService } from './cart.service';

const product = (id: number, over: object = {}) => ({
  id,
  name: `Товар ${id}`,
  slug: `p-${id}`,
  price: 1000,
  discount: 10,
  stock: { S: 5 },
  images: [],
  isActive: true,
  ...over,
});

describe('CartService.validateCart', () => {
  it('returns unavailable items instead of failing the whole cart', async () => {
    const prisma = {
      product: {
        // id 2 выключен, id 3 удалён (не возвращается запросом с deletedAt: null)
        findMany: jest
          .fn()
          .mockResolvedValue([product(1), product(2, { isActive: false })]),
      },
    };
    const service = new CartService(prisma as any);

    const result = await service.validateCart([
      { productId: 1, size: 'S', quantity: 2 },
      { productId: 2, size: 'S', quantity: 1 },
      { productId: 3, size: 'M', quantity: 1 },
    ]);

    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toMatchObject({
      productId: 1,
      inStock: true,
      isAvailable: true,
      totalPrice: 1800,
    });
    for (const unavailable of result.items.slice(1)) {
      expect(unavailable).toMatchObject({
        inStock: false,
        availableQuantity: 0,
        isAvailable: false,
        totalPrice: 0,
      });
    }
    expect(result.items[1].productName).toBe('Товар 2');
    expect(result.subtotal).toBe(1800);
    expect(result.total).toBe(1800);
  });
});
