import { OrdersService } from './orders.service';
import { AdminOrdersService } from '../admin/orders/admin-orders.service';
import { CartService } from '../cart/cart.service';
import { purchaseAvailability } from '../common/utils/preorder.util';

// In-memory database with rollback: failures must undo both counters and order changes.
function setup() {
  let state: any = {
    products: [
      {
        id: 1,
        name: 'Preorder',
        slug: 'pre',
        cardStatus: 'PRE_ORDER',
        // У предзаказа обычный stock: «M — 2» = можно предзаказать 2 штуки.
        stock: { M: 2 },
        price: 1000,
        discount: 0,
        images: [],
        isActive: true,
        deletedAt: null,
        salesCount: 0,
      },
      {
        id: 2,
        name: 'Regular',
        slug: 'regular',
        cardStatus: 'NONE',
        stock: { M: 3 },
        price: 500,
        discount: 0,
        images: [],
        isActive: true,
        deletedAt: null,
        salesCount: 0,
      },
    ],
    order: null,
  };
  const copy = <T>(value: T): T => structuredClone(value);
  const matches = (value: any, where: any) =>
    Object.entries(where).every(([key, expected]: [string, any]) =>
      typeof expected === 'object' && expected !== null
        ? value[key] !== expected.not
        : value[key] === expected,
    );
  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    product: {
      findFirst: jest.fn(async ({ where }) =>
        copy(state.products.find((p: any) => p.id === where.id)),
      ),
      findUnique: jest.fn(async ({ where }) =>
        copy(state.products.find((p: any) => p.id === where.id)),
      ),
      findMany: jest.fn(async () => copy(state.products)),
      update: jest.fn(async ({ where, data }) => {
        const p = state.products.find((p: any) => p.id === where.id);
        for (const [key, value] of Object.entries(data) as any) {
          if (key === 'salesCount')
            p[key] += value.increment ?? -value.decrement;
          else p[key] = copy(value);
        }
        return copy(p);
      }),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => {
        state.order = {
          ...copy(data),
          id: 'order-id',
          inventoryReleased: false,
          items: data.items.create.map((item: any, i: number) => ({
            ...copy(item),
            id: `item-${i}`,
          })),
        };
        return copy(state.order);
      }),
      findUnique: jest.fn(async () => copy(state.order)),
      update: jest.fn(async ({ data }) => {
        Object.assign(state.order, copy(data));
        return copy(state.order);
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (!state.order || !matches(state.order, where)) return { count: 0 };
        Object.assign(state.order, copy(data));
        return { count: 1 };
      }),
    },
    orderItem: {
      findMany: jest.fn(async () => copy(state.order.items)),
      updateMany: jest.fn(async ({ where, data }) => {
        for (const item of state.order.items) {
          if (matches({ ...item, orderId: state.order.id }, where))
            Object.assign(item, copy(data));
        }
        return { count: 1 };
      }),
      deleteMany: jest.fn(async () => {
        state.order.items = [];
      }),
      createMany: jest.fn(async ({ data }) => {
        state.order.items = copy(data);
      }),
    },
  };
  prisma.$transaction = jest.fn(async (fn) => {
    const before = copy(state);
    try {
      return await fn(prisma);
    } catch (error) {
      state = before;
      throw error;
    }
  });
  const email: any = { sendOrderConfirmation: jest.fn(), sendRaw: jest.fn() };
  const delivery: any = {
    createCdekOrder: jest.fn().mockResolvedValue({ uuid: 'cdek' }),
    isCdekShipped: jest.fn().mockReturnValue(false),
  };
  const bank: any = {
    registerOrder: jest
      .fn()
      .mockResolvedValue({
        paymentId: 'payment',
        paymentUrl: 'https://bank.test/pay',
      }),
  };
  const orders = new OrdersService(
    prisma,
    email,
    { clearCart: jest.fn() } as any,
    {} as any,
    {} as any,
    bank,
    delivery,
  );
  const admin = new AdminOrdersService(prisma, email, delivery, orders);
  const create = (items = [{ productId: 1, size: 'M', quantity: 1 }]) =>
    orders.createManualOrder({
      items,
      firstName: 'Test',
      lastName: 'Test',
      email: 'test@example.com',
      phone: '123',
      deliveryType: 'CDEK_PICKUP',
      cdekCityCode: 44,
      paymentMethod: 'BANK_TRANSFER',
    });
  return {
    orders,
    admin,
    prisma,
    email,
    delivery,
    bank,
    create,
    state: () => state,
  };
}

describe('Preorders', () => {
  it('sells a preorder from its regular stock without requiring a date', async () => {
    const t = setup();
    const cart = await new CartService(t.prisma).validateCart([
      { productId: 1, size: 'M', quantity: 1 },
    ]);
    expect(cart.items[0]).toMatchObject({
      isPreorder: true,
      canPurchase: true,
      availableQuantity: 2,
    });
    expect(
      purchaseAvailability(t.state().products[0], 'M').availableQuantity,
    ).toBe(2);
  });

  it('accepts, edits and fulfills a dateless preorder only after manager confirmation', async () => {
    const t = setup();
    const order = await t.create();
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    await t.admin.updateOrderItems(order.orderNumber, [{ productId: 1, size: 'M', quantity: 1 }]);
    expect(t.state().order).toMatchObject({ status: 'AWAITING_PREORDER', isPaid: true });
    expect(t.delivery.createCdekOrder).not.toHaveBeenCalled();
    await t.admin.markPreorderReady(order.orderNumber);
    expect(t.state().order.status).toBe('CONFIRMED');
    // Списано один раз при оформлении — отметка «поступил» stock не трогает.
    expect(t.state().products[0]).toMatchObject({ stock: { M: 1 }, salesCount: 1 });
    expect(t.email.sendRaw).toHaveBeenCalledWith('test@example.com', 'Предзаказ готов к отправке', expect.any(String));
    expect(t.delivery.createCdekOrder).toHaveBeenCalledTimes(1);
  });

  it('reserves a slot and snapshots terms, while payment waits without a CDEK invoice', async () => {
    const t = setup();
    const order = await t.create();
    expect(t.state().products[0]).toMatchObject({
      stock: { M: 1 },
      salesCount: 1,
    });
    expect(order.items[0]).toMatchObject({
      isPreorder: true,
    });
    t.state().products[0].cardStatus = 'NONE';
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    await t.orders.updatePaymentStatus(order.orderNumber, 'PENDING');
    expect(t.state().order).toMatchObject({
      isPaid: true,
      status: 'AWAITING_PREORDER',
    });
    expect(t.email.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(t.delivery.createCdekOrder).not.toHaveBeenCalled();
    await expect(
      t.admin.createCdekInvoice(order.orderNumber),
    ).rejects.toThrow();
    await expect(
      t.admin.updateStatus(order.orderNumber, 'SHIPPED'),
    ).rejects.toThrow();
  });

  it('returns the unit to stock exactly once on timeout', async () => {
    const t = setup();
    const order = await t.create();
    await t.orders.updatePaymentStatus(order.orderNumber, 'CANCELED');
    await t.orders.updatePaymentStatus(order.orderNumber, 'CANCELED');
    expect(t.state().products[0]).toMatchObject({
      stock: { M: 2 },
      salesCount: 0,
    });
    expect(t.state().order.inventoryReleased).toBe(true);
  });

  it('rolls back the full order when duplicate positions exceed the limit', async () => {
    const t = setup();
    await expect(
      t.create([
        { productId: 1, size: 'M', quantity: 2 },
        { productId: 1, size: 'M', quantity: 1 },
      ]),
    ).rejects.toThrow();
    expect(t.state().order).toBeNull();
    expect(t.state().products[0].stock.M).toBe(2);
  });

  it('creates a payable online preorder and releases the slot if bank registration fails', async () => {
    for (const fail of [false, true]) {
      const t = setup();
      jest
        .spyOn(t.orders as any, 'calculateDeliveryPrice')
        .mockResolvedValue(0);
      if (fail)
        t.bank.registerOrder.mockRejectedValue(new Error('Bank unavailable'));
      const pending = t.orders.createOrder({
        items: [{ productId: 1, size: 'M', quantity: 1 }],
        firstName: 'Test',
        lastName: 'Test',
        email: 'test@example.com',
        phone: '123',
        deliveryType: 'STANDARD',
        countryName: 'RU',
        street: 'Street',
        postalCode: '123456',
        paymentMethod: 'CARD_ONLINE',
      });
      if (fail) {
        await expect(pending).rejects.toThrow();
        expect(t.state().products[0].stock.M).toBe(2);
        expect(t.state().order).toMatchObject({
          inventoryReleased: true,
          status: 'PAYMENT_FAILED',
        });
      } else {
        const order = await pending;
        expect(order).toMatchObject({
          paymentUrl: 'https://bank.test/pay',
          total: 1000,
          items: [expect.objectContaining({ isPreorder: true })],
        });
        expect(t.bank.registerOrder).toHaveBeenCalledWith(
          expect.objectContaining({ amount: 1000 }),
        );
        expect(t.state().products[0].stock.M).toBe(1);
      }
    }
  });

  it('preserves snapshot terms when an existing preorder is edited after the badge changes', async () => {
    const t = setup();
    const order = await t.create();
    t.state().products[0].cardStatus = 'NONE';
    await t.admin.updateOrderItems(order.orderNumber, [
      { productId: 1, size: 'M', quantity: 2 },
    ]);
    expect(t.state().products[0]).toMatchObject({ stock: { M: 0 } });
    expect(t.state().order.items[0]).toMatchObject({
      isPreorder: true,
    });
  });

  it('waits for the manager to confirm arrival, then ships the whole mixed order once', async () => {
    const t = setup();
    const order = await t.create([
      { productId: 1, size: 'M', quantity: 1 },
      { productId: 2, size: 'M', quantity: 1 },
    ]);
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    expect(t.state().products[1].stock.M).toBe(2);
    expect(t.state().order.status).toBe('AWAITING_PREORDER');
    expect(t.state().order.items[0].preorderReady).toBe(false);
    expect(t.delivery.createCdekOrder).not.toHaveBeenCalled();
    await t.admin.markPreorderReady(order.orderNumber);
    expect(t.state().products[0]).toMatchObject({
      stock: { M: 1 },
      salesCount: 1,
    });
    expect(t.state().order).toMatchObject({
      status: 'CONFIRMED',
      items: [
        expect.objectContaining({ preorderReady: true }),
        expect.anything(),
      ],
    });
    expect(t.delivery.createCdekOrder).toHaveBeenCalledTimes(1);
    await expect(
      t.admin.markPreorderReady(order.orderNumber),
    ).rejects.toThrow();
  });

  it('cancels or refunds an unfulfilled preorder without releasing inventory twice', async () => {
    const t = setup();
    const order = await t.create();
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    await t.admin.cancelOrder(order.orderNumber);
    await t.orders.recordRefund(order.orderNumber);
    await t.orders.recordRefund(order.orderNumber);
    expect(t.state().products[0]).toMatchObject({
      stock: { M: 2 },
      salesCount: 0,
    });
  });

  it('returns preorder and regular units to stock on a bank refund', async () => {
    const t = setup();
    const order = await t.create([
      { productId: 1, size: 'M', quantity: 1 },
      { productId: 2, size: 'M', quantity: 1 },
    ]);
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    await t.orders.updatePaymentStatus(order.orderNumber, 'REFUNDED');
    await t.orders.updatePaymentStatus(order.orderNumber, 'REFUNDED');
    expect(t.state().products[0].stock.M).toBe(2);
    expect(t.state().products[1].stock.M).toBe(3);
    expect(t.state().order).toMatchObject({
      status: 'REFUNDED',
      isPaid: false,
      inventoryReleased: true,
    });
  });

  it('returns the unit to stock when a ready preorder is cancelled', async () => {
    const t = setup(); const order = await t.create();
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    await t.admin.markPreorderReady(order.orderNumber);
    t.delivery.deleteCdekOrder = jest.fn();
    await t.admin.cancelOrder(order.orderNumber);
    expect(t.state().products[0]).toMatchObject({ stock: { M: 2 }, salesCount: 0 });
    expect(t.email.sendRaw).toHaveBeenCalledTimes(2);
  });

  it('restores the reservation after a late payment, or records payment for manual resolution when sold out', async () => {
    for (const soldOut of [false, true]) {
      const t = setup();
      const order = await t.create();
      await t.orders.updatePaymentStatus(order.orderNumber, 'CANCELED');
      if (soldOut) t.state().products[0].stock.M = 0;
      await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
      expect(t.state().order).toMatchObject({
        isPaid: true,
        inventoryReleased: soldOut,
        status: soldOut ? 'PROCESSING' : 'AWAITING_PREORDER',
      });
      expect(t.state().products[0].stock.M).toBe(soldOut ? 0 : 1);
      expect(t.delivery.createCdekOrder).not.toHaveBeenCalled();
    }
  });

  it('keeps ordinary orders on the existing payment and delivery path', async () => {
    const t = setup();
    const order = await t.create([{ productId: 2, size: 'M', quantity: 1 }]);
    await t.orders.updatePaymentStatus(order.orderNumber, 'PAID');
    expect(t.state().order.status).toBe('CONFIRMED');
    expect(t.delivery.createCdekOrder).toHaveBeenCalledTimes(1);
  });
});
