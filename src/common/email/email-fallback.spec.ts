import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const LIMIT = new Error(
  'Data command failed: 550-5.4.5 Daily user sending limit exceeded.',
);

function setup() {
  Object.assign(process.env, {
    EMAIL_HOST: 'smtp.gmail.com',
    EMAIL_USER: 'main@gmail.com',
    EMAIL_PASS: 'main-pass',
    EMAIL_FROM: 'main@gmail.com',
    EMAIL_FALLBACK_USER: 'reserve@gmail.com',
    EMAIL_FALLBACK_PASS: 'reserve-pass',
    EMAIL_FALLBACK_FROM: 'reserve@gmail.com',
  });
  const main = { sendMail: jest.fn(), verify: jest.fn().mockResolvedValue(true) };
  const reserve = { sendMail: jest.fn(), verify: jest.fn().mockResolvedValue(true) };
  (nodemailer.createTransport as jest.Mock)
    .mockReset()
    .mockReturnValueOnce(main)
    .mockReturnValueOnce(reserve);
  const service = new EmailService();
  const errors: string[] = [];
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: (m: string) => errors.push(m) };
  return { service, main, reserve, errors };
}

describe('Почта: основной и запасной ящик', () => {
  it('обычно шлёт с основного', async () => {
    const t = setup();
    await expect(t.service.sendRaw('a@b.c', 'Тема', '<p>x</p>')).resolves.toBe(true);
    expect(t.main.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'main@gmail.com', to: 'a@b.c' }),
    );
    expect(t.reserve.sendMail).not.toHaveBeenCalled();
  });

  it('при лимите основного шлёт с запасного и ставит основной на паузу', async () => {
    const t = setup();
    t.main.sendMail.mockRejectedValueOnce(LIMIT);
    await t.service.sendVerificationCode('a@b.c', '4821');
    expect(t.reserve.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'reserve@gmail.com' }),
    );
    // Код из темы не попадает в лог
    expect(t.errors.join('\n')).not.toContain('4821');
    expect(t.errors.join('\n')).toContain('пауза 60 мин');

    await t.service.sendRaw('a@b.c', 'Второе', '<p>x</p>');
    expect(t.main.sendMail).toHaveBeenCalledTimes(1);
    expect(t.reserve.sendMail).toHaveBeenCalledTimes(2);
  });

  it('рассылка не трогает запасной ящик', async () => {
    const t = setup();
    t.main.sendMail.mockRejectedValueOnce(LIMIT);
    await expect(
      t.service.sendRaw('a@b.c', 'Новинка', '<p>x</p>', { bulk: true }),
    ).resolves.toBe(false);
    expect(t.reserve.sendMail).not.toHaveBeenCalled();
  });

  it('обычная ошибка не ставит ящик на паузу', async () => {
    const t = setup();
    t.main.sendMail.mockRejectedValueOnce(new Error('550 5.1.1 user unknown'));
    await t.service.sendRaw('bad@b.c', 'Тема', '<p>x</p>');
    await t.service.sendRaw('ok@b.c', 'Тема', '<p>x</p>');
    expect(t.main.sendMail).toHaveBeenCalledTimes(2);
  });
});
