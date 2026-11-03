import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const future = () => new Date(Date.now() + 60_000);

function setup(stored: { id: string; expiresAt: Date } | null, deleted = 1) {
  const prisma = {
    refreshToken: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          stored && { ...stored, user: { id: 'u1', email: 'a@b.c' } },
        ),
      deleteMany: jest.fn().mockResolvedValue({ count: deleted }),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const jwt = { sign: jest.fn().mockReturnValue('access') };
  process.env.JWT_ACCESS_SECRET ||= 'test-secret';
  const service = new AuthService(
    prisma as any,
    jwt as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, prisma };
}

describe('AuthService refresh tokens', () => {
  it('stores only the hash of a new refresh token', async () => {
    const { service, prisma } = setup({ id: 't1', expiresAt: future() });
    const { refreshToken } = await service.refreshTokens('old-token');
    const saved = prisma.refreshToken.create.mock.calls[0][0].data.token;
    expect(saved).toBe(sha256(refreshToken));
    expect(saved).not.toBe(refreshToken);
  });

  it('finds a token by hash and, for old records, by the raw value', async () => {
    const { service, prisma } = setup({ id: 't1', expiresAt: future() });
    await service.refreshTokens('old-token');
    expect(prisma.refreshToken.findFirst.mock.calls[0][0].where).toEqual({
      token: { in: [sha256('old-token'), 'old-token'] },
    });
  });

  it('gives 401, not 500, when a parallel request already rotated the token', async () => {
    const { service, prisma } = setup({ id: 't1', expiresAt: future() }, 0);
    await expect(service.refreshTokens('old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects unknown and expired tokens', async () => {
    await expect(setup(null).service.refreshTokens('x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      setup({ id: 't1', expiresAt: new Date(0) }).service.refreshTokens('x'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout removes the token stored either way', async () => {
    const { service, prisma } = setup(null);
    await service.logout('tok');
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: [sha256('tok'), 'tok'] } },
    });
  });
});
