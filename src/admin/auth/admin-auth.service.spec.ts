import { AdminAuthService } from './admin-auth.service';

describe('Admin login delivery', () => {
  function setup(sent: boolean) {
    const prisma = { adminLoginRequest: { create: jest.fn(), delete: jest.fn().mockResolvedValue({}) } };
    const service = new AdminAuthService(prisma as any, {} as any, {} as any);
    jest.spyOn(service as any, 'sendLoginRequest').mockResolvedValue(sent);
    return { service, prisma };
  }

  it('removes a login request when Telegram delivery fails and returns a retryable error', async () => {
    const { service, prisma } = setup(false);
    await expect(service.requestLogin('127.0.0.1', 'deployment-test')).rejects.toMatchObject({ status: 503 });
    expect(prisma.adminLoginRequest.delete).toHaveBeenCalledWith({ where: { loginId: prisma.adminLoginRequest.create.mock.calls[0][0].data.loginId } });
  });

  it('keeps a delivered login request available for approval', async () => {
    const { service, prisma } = setup(true);
    const result = await service.requestLogin('127.0.0.1', 'deployment-test');
    expect(result).toMatchObject({ expiresIn: 300, loginId: expect.any(String) });
    expect(prisma.adminLoginRequest.delete).not.toHaveBeenCalled();
  });
});
