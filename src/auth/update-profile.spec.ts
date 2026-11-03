import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const MONTH = 30 * 24 * 60 * 60 * 1000;

function setup(user: {
  birthdate: Date | null;
  birthdateUpdatedAt: Date | null;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockImplementation(({ data }) => data),
    },
  };
  const service = new AuthService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, prisma };
}

const errorsFor = async (body: object) =>
  (await validate(plainToInstance(UpdateProfileDto, body))).map(
    (e) => e.property,
  );

describe('UpdateProfileDto', () => {
  it('accepts null as "clear" for optional fields', async () => {
    expect(
      await errorsFor({
        middleName: null,
        socialContact: null,
        birthdate: null,
      }),
    ).toEqual([]);
  });

  it('rejects null for name and phone', async () => {
    expect(
      (
        await errorsFor({ firstName: null, lastName: null, phone: null })
      ).sort(),
    ).toEqual(['firstName', 'lastName', 'phone']);
  });
});

describe('AuthService.updateProfile birthdate', () => {
  it('clears birthdate and starts the once-a-year period', async () => {
    const { service, prisma } = setup({
      birthdate: new Date('2000-01-01'),
      birthdateUpdatedAt: new Date(Date.now() - 13 * MONTH),
    });
    await service.updateProfile('u1', { birthdate: null });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.birthdate).toBeNull();
    expect(data.birthdateUpdatedAt).toBeInstanceOf(Date);
  });

  it('does not allow setting a new date right after clearing', async () => {
    const { service } = setup({
      birthdate: null,
      birthdateUpdatedAt: new Date(Date.now() - MONTH),
    });
    await expect(
      service.updateProfile('u1', { birthdate: '13.07.2003' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats clearing an already empty date as a no-op', async () => {
    const { service, prisma } = setup({
      birthdate: null,
      birthdateUpdatedAt: new Date(Date.now() - MONTH),
    });
    await service.updateProfile('u1', { birthdate: null, middleName: null });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).toEqual({ middleName: null });
  });

  it('allows the first birthdate', async () => {
    const { service, prisma } = setup({
      birthdate: null,
      birthdateUpdatedAt: null,
    });
    await service.updateProfile('u1', { birthdate: '13.07.2003' });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.birthdate.toISOString()).toBe('2003-07-13T00:00:00.000Z');
  });
});
