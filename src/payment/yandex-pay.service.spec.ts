import { generateKeyPairSync, sign } from 'crypto';
import { YandexPayService } from './yandex-pay.service';

const MERCHANT = '11111111-2222-3333-4444-555555555555';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const { privateKey: otherKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function token(payload: object, key = privateKey, kid = 'k1') {
  const head = `${b64({ alg: 'ES256', kid, typ: 'JWT' })}.${b64(payload)}`;
  const signature = sign('sha256', Buffer.from(head), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${signature.toString('base64url')}`;
}

describe('YandexPayService', () => {
  const original = { ...process.env };
  let service: YandexPayService;
  let jwksCalls: number;

  beforeEach(() => {
    process.env.YANDEX_PAY_MERCHANT_ID = MERCHANT;
    process.env.YANDEX_PAY_API_KEY = 'test-key';
    process.env.YANDEX_PAY_METHODS = 'CARD,SPLIT';
    service = new YandexPayService();
    jwksCalls = 0;
    (service as any).http.get = async () => {
      jwksCalls += 1;
      return { data: { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1' }] } };
    };
  });
  afterAll(() => {
    process.env = original;
  });

  const now = () => Math.floor(Date.now() / 1000);
  const payload = (extra: object = {}) => ({
    merchantId: MERCHANT,
    event: 'ORDER_STATUS_UPDATED',
    order: { orderId: 'SC-1', paymentStatus: 'CAPTURED' },
    iat: now(),
    exp: now() + 300,
    ...extra,
  });

  it('принимает токен, подписанный ключом Яндекса', async () => {
    const result = await service.verifyWebhookToken(token(payload()));
    expect(result?.order?.orderId).toBe('SC-1');
  });

  it('отклоняет чужую подпись, чужой мерчант, просроченный токен и мусор', async () => {
    expect(await service.verifyWebhookToken(token(payload(), otherKey))).toBeNull();
    expect(
      await service.verifyWebhookToken(token(payload({ merchantId: 'other' }))),
    ).toBeNull();
    expect(
      await service.verifyWebhookToken(token(payload({ exp: now() - 3600 }))),
    ).toBeNull();
    expect(await service.verifyWebhookToken('not.a.jwt')).toBeNull();
    expect(await service.verifyWebhookToken('garbage')).toBeNull();
  });

  it('не перечитывает ключи на каждый неизвестный kid', async () => {
    await service.verifyWebhookToken(token(payload()));
    await service.verifyWebhookToken(token(payload(), privateKey, 'unknown'));
    await service.verifyWebhookToken(token(payload(), privateKey, 'unknown-2'));
    expect(jwksCalls).toBe(1);
  });

  it('деньги получены только в CAPTURED', () => {
    expect(service.mapStatus('CAPTURED')).toBe('PAID');
    expect(service.mapStatus('AUTHORIZED')).toBe('PENDING');
    expect(service.mapStatus('CONFIRMED')).toBe('PENDING');
    expect(service.mapStatus('PARTIALLY_REFUNDED')).toBe('PENDING');
    expect(service.mapStatus('VOIDED')).toBe('CANCELED');
    expect(service.mapStatus('FAILED')).toBe('FAILED');
    expect(service.mapStatus('REFUNDED')).toBe('REFUNDED');
  });

  it('не включается без ключа или с неизвестными способами оплаты', () => {
    process.env.YANDEX_PAY_METHODS = 'SBP';
    expect(new YandexPayService().isConfigured()).toBe(false);
    process.env.YANDEX_PAY_METHODS = 'CARD,SPLIT';
    process.env.YANDEX_PAY_API_KEY = '';
    expect(new YandexPayService().isConfigured()).toBe(false);
  });
});
