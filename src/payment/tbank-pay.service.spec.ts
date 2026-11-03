import { createHash } from 'crypto';
import { TbankPayService } from './tbank-pay.service';

describe('TbankPayService', () => {
  let service: TbankPayService;
  const original = { ...process.env };
  beforeEach(() => {
    process.env.TBANK_TERMINAL_KEY = 'test-terminal';
    process.env.TBANK_PASSWORD = 'test-password';
    service = new TbankPayService();
  });
  afterAll(() => {
    process.env = original;
  });

  it('signs only sorted root values, including false and excluding nested objects', () => {
    const payload = {
      TerminalKey: 'test-terminal',
      Amount: 100,
      Success: false,
      DATA: { x: 1 },
      Token: 'ignored',
    };
    const expected = createHash('sha256')
      .update('100test-passwordfalsetest-terminal')
      .digest('hex');
    expect(service.createToken(payload)).toBe(expected);
  });

  it('rejects forged, malformed and wrong-terminal notifications', () => {
    const body = {
      TerminalKey: 'test-terminal',
      OrderId: 'order',
      Amount: 100,
    };
    const Token = service.createToken(body);
    expect(service.verifyNotification({ ...body, Token })).toBe(true);
    expect(service.verifyNotification({ ...body, Amount: 101, Token })).toBe(
      false,
    );
    expect(service.verifyNotification({ ...body, Token: 'invalid' })).toBe(
      false,
    );
    expect(
      service.verifyNotification({ ...body, TerminalKey: 'other', Token }),
    ).toBe(false);
  });

  it('confirms only captured payments and distinguishes full refunds', () => {
    expect(service.mapStatus('AUTHORIZED')).toBe('PENDING');
    expect(service.mapStatus('CONFIRMED')).toBe('PAID');
    expect(service.mapStatus('PARTIAL_REFUNDED')).toBe('PENDING');
    expect(service.mapStatus('REFUNDED')).toBe('REFUNDED');
    expect(service.mapStatus('DEADLINE_EXPIRED')).toBe('CANCELED');
    expect(service.mapStatus('REJECTED')).toBe('FAILED');
  });

  it('sends the payment expiry with an explicit timezone accepted by the bank', async () => {
    const previousBackend = process.env.BACKEND_URL;
    process.env.BACKEND_URL = 'https://shop.example/api';
    const post = jest.spyOn((service as any).http, 'post').mockResolvedValue({
      data: {
        Success: true,
        ErrorCode: '0',
        PaymentId: 'test-payment',
        PaymentURL: 'https://pay.tbank-online.com/test',
      },
    });
    try {
      await service.registerOrder({
        orderNumber: 'test-order',
        amount: 1,
        successUrl: 'https://shop.example/order/test-order?payment=success',
        failUrl: 'https://shop.example/order/test-order?payment=fail',
        ttlMinutes: 15,
      });
      expect(post).toHaveBeenCalledWith(
        expect.stringContaining('/Init'),
        expect.objectContaining({
          Amount: 100,
          RedirectDueDate: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/,
          ),
          NotificationURL: 'https://shop.example/api/payment/tbank/webhook',
        }),
      );
    } finally {
      post.mockRestore();
      if (previousBackend === undefined) delete process.env.BACKEND_URL;
      else process.env.BACKEND_URL = previousBackend;
    }
  });
});
