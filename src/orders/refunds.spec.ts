import { OrdersService } from './orders.service';
import { AdminOrdersService } from '../admin/orders/admin-orders.service';

// Оплаченный через Т-Банк заказ: 1 пуховик M за 17 900 ₽ + 800 ₽ доставки.
function setup(order: Record<string, any> = {}) {
  let state: any = {
    product: {
      id: 9,
      name: 'Puffer',
      stock: { M: 5 },
      salesCount: 10,
      cardStatus: 'NONE',
    },
    order: {
      id: 'o1',
      orderNumber: 'SALIY1',
      email: 'buyer@example.com',
      status: 'CONFIRMED',
      isPaid: true,
      paymentMethod: 'CARD_ONLINE',
      paymentId: 'pay-1',
      total: 18700,
      refundedAmount: 0,
      inventoryReleased: false,
      cdekUuid: 'cdek-uuid',
      cdekStatus: 'CREATED',
      items: [{ id: 'i1', productId: 9, size: 'M', quantity: 1 }],
      ...order,
    },
  };
  const copy = <T>(value: T): T => structuredClone(value);
  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    product: {
      findUnique: jest.fn(async () => copy(state.product)),
      findFirst: jest.fn(async () => copy(state.product)),
      findMany: jest.fn(async () => [copy(state.product)]),
      update: jest.fn(async ({ data }) => {
        for (const [key, value] of Object.entries(data) as any) {
          if (key === 'salesCount')
            state.product[key] += value.increment ?? -value.decrement;
          else state.product[key] = copy(value);
        }
        return copy(state.product);
      }),
    },
    order: {
      findUnique: jest.fn(async () => copy(state.order)),
      update: jest.fn(async ({ data }) => {
        Object.assign(state.order, copy(data));
        return copy(state.order);
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
  const email: any = { sendRaw: jest.fn().mockResolvedValue(true) };
  const delivery: any = {
    isCdekShipped: jest.fn((code) => code === 'SHIPPED_CODE'),
    deleteCdekOrder: jest.fn().mockResolvedValue(undefined),
  };
  const bank: any = {
    refundPayment: jest.fn().mockResolvedValue({ Success: true }),
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
  return { orders, admin, bank, delivery, email, state: () => state };
}

describe('Возврат денег', () => {
  it('полный возврат: деньги через Т-Банк в копейках, товар на склад, накладная удалена', async () => {
    const t = setup();
    const res = await t.admin.refundOrder('SALIY1', { reason: 'передумал' });
    expect(t.bank.refundPayment).toHaveBeenCalledWith('pay-1', 1870000);
    expect(res.refund).toMatchObject({
      amount: 18700,
      full: true,
      stockReturned: true,
      viaBank: true,
    });
    expect(t.state().order).toMatchObject({
      status: 'REFUNDED',
      isPaid: false,
      refundedAmount: 18700,
      inventoryReleased: true,
      cdekUuid: null,
    });
    expect(t.state().product.stock).toEqual({ M: 6 });
    expect(t.delivery.deleteCdekOrder).toHaveBeenCalledWith('cdek-uuid');
    expect(t.email.sendRaw).toHaveBeenCalledTimes(1);
  });

  it('частичный возврат не меняет статус и склад, остаток можно вернуть потом', async () => {
    const t = setup();
    const first = await t.admin.refundOrder('SALIY1', {
      reason: 'компенсация доставки',
      amount: 800,
    });
    expect(t.bank.refundPayment).toHaveBeenLastCalledWith('pay-1', 80000);
    expect(first.refund).toMatchObject({ full: false, stockReturned: false });
    expect(t.state().order).toMatchObject({
      status: 'CONFIRMED',
      isPaid: true,
      refundedAmount: 800,
    });
    expect(t.state().product.stock).toEqual({ M: 5 });

    await expect(
      t.admin.refundOrder('SALIY1', { reason: 'ещё', amount: 17900.01 }),
    ).rejects.toThrow('Можно вернуть не больше 17900 ₽');

    const rest = await t.admin.refundOrder('SALIY1', { reason: 'остаток' });
    expect(t.bank.refundPayment).toHaveBeenLastCalledWith('pay-1', 1790000);
    expect(rest.refund).toMatchObject({ full: true, refundedTotal: 18700 });
    expect(t.state().order.status).toBe('REFUNDED');
  });

  it('повторный возврат после полного не идёт в банк', async () => {
    const t = setup();
    await t.admin.refundOrder('SALIY1', { reason: 'r' });
    await expect(
      t.admin.refundOrder('SALIY1', { reason: 'r' }),
    ).rejects.toThrow('уже возвращены');
    expect(t.bank.refundPayment).toHaveBeenCalledTimes(1);
  });

  it('отказ банка ничего не записывает', async () => {
    const t = setup();
    t.bank.refundPayment.mockRejectedValueOnce(
      new Error('Т-Банк отклонил запрос: 9999, Недостаточно средств'),
    );
    await expect(
      t.admin.refundOrder('SALIY1', { reason: 'r' }),
    ).rejects.toThrow('Недостаточно средств');
    expect(t.state().order).toMatchObject({
      status: 'CONFIRMED',
      isPaid: true,
      refundedAmount: 0,
    });
    expect(t.state().product.stock).toEqual({ M: 5 });
  });

  it('после отмены заказа возврат денег не возвращает товар второй раз', async () => {
    const t = setup({ status: 'CANCELLED', inventoryReleased: true });
    const res = await t.admin.refundOrder('SALIY1', { reason: 'отмена' });
    expect(res.refund).toMatchObject({ full: true, stockReturned: false });
    expect(t.state().product.stock).toEqual({ M: 5 });
    expect(t.state().order.status).toBe('REFUNDED');
  });

  it('отправленный заказ: деньги возвращаются, товар на склад — нет', async () => {
    const t = setup({ cdekStatus: 'SHIPPED_CODE' });
    const res = await t.admin.refundOrder('SALIY1', { reason: 'брак' });
    expect(res.refund.stockReturned).toBe(false);
    expect(t.state().product.stock).toEqual({ M: 5 });
    expect(t.delivery.deleteCdekOrder).not.toHaveBeenCalled();
  });

  it('оплата не через Т-Банк требует ручной отметки, банк не вызывается', async () => {
    const t = setup({ paymentMethod: 'BANK_TRANSFER', paymentId: null });
    await expect(
      t.admin.refundOrder('SALIY1', { reason: 'r' }),
    ).rejects.toThrow('manual: true');
    const res = await t.admin.refundOrder('SALIY1', {
      reason: 'вернул переводом',
      manual: true,
    });
    expect(res.refund).toMatchObject({ viaBank: false, full: true });
    expect(t.bank.refundPayment).not.toHaveBeenCalled();
  });

  it('статус «Возврат» из списка только отмечает возврат, деньги не двигает', async () => {
    const t = setup();
    await t.admin.updateStatus('SALIY1', 'REFUNDED' as any);
    expect(t.bank.refundPayment).not.toHaveBeenCalled();
    expect(t.state().order.status).toBe('REFUNDED');
  });

  it('неоплаченный заказ вернуть нельзя', async () => {
    const t = setup({ isPaid: false, status: 'PENDING' });
    await expect(
      t.admin.refundOrder('SALIY1', { reason: 'r' }),
    ).rejects.toThrow('не оплачен');
  });
});
