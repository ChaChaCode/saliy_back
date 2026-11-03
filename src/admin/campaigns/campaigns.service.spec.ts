import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

const product = {
  id: 7,
  name: 'Куртка <b>"X"</b>',
  slug: 'jacket-x',
  description: null,
  price: 1000,
  discount: 0,
  images: [{ url: 'products/a-opt.jpg', previewOrder: 1 }],
  isActive: true,
  deletedAt: null,
};

function setup(
  overrides: { product?: object | null; claimCount?: number } = {},
) {
  const prisma = {
    product: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.product === undefined ? product : overrides.product,
        ),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: overrides.claimCount ?? 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    emailCampaign: {
      create: jest
        .fn()
        .mockImplementation(({ data }) => ({ id: 'c1', ...data })),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const email = { sendRaw: jest.fn().mockResolvedValue(true) };
  const newsletter = {
    getActiveSubscriberEmails: jest
      .fn()
      .mockResolvedValue([{ email: 'a@example.com', unsubscribeToken: 't' }]),
  };
  const s3 = { keyToUrl: (k: string) => `https://cdn.test/${k}` };
  prisma.emailCampaign.findUnique.mockImplementation(
    () => prisma.emailCampaign.create.mock.results[0]?.value,
  );
  const service = new CampaignsService(
    prisma as any,
    email as any,
    newsletter as any,
    s3 as any,
  );
  return { service, prisma, email, newsletter };
}

describe('CampaignsService.notifyAboutProduct', () => {
  const original = { ...process.env };
  beforeAll(() => {
    process.env.FRONTEND_URL = 'https://shop.test/';
  });
  afterAll(() => {
    process.env = original;
  });

  it('creates a NEWSLETTER campaign with escaped name, product link and JPEG cover', async () => {
    const { service, prisma } = setup();
    await service.notifyAboutProduct(7, 'admin');
    const data = prisma.emailCampaign.create.mock.calls[0][0].data;
    expect(data.targetType).toBe('NEWSLETTER');
    expect(data.html).toContain('https://shop.test/product/jacket-x');
    expect(data.html).toContain('https://cdn.test/products/a-opt.jpg');
    expect(data.html).toContain('https://cdn.test/email/saliy-logo-v1.png');
    expect(data.html).not.toContain('<svg');
    expect(data.html).not.toContain('<b>');
    expect(data.html).toContain('&#60;b&#62;');
  });

  it('sends only once per product', async () => {
    const { service, prisma } = setup({ claimCount: 0 });
    await expect(service.notifyAboutProduct(7)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.emailCampaign.create).not.toHaveBeenCalled();
  });

  it('rejects hidden and missing products', async () => {
    await expect(
      setup({
        product: { ...product, isActive: false },
      }).service.notifyAboutProduct(7),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      setup({ product: null }).service.notifyAboutProduct(7),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('releases the once-only mark when sending cannot start', async () => {
    const { service, prisma, newsletter } = setup();
    newsletter.getActiveSubscriberEmails.mockResolvedValue([]);
    await expect(service.notifyAboutProduct(7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { newsletterSentAt: null },
    });
  });
});

describe('CampaignsService.startSending', () => {
  it('refuses a second start of the same campaign', async () => {
    const { service, prisma } = setup();
    prisma.emailCampaign.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'DRAFT',
      targetType: 'NEWSLETTER',
      subject: 's',
      html: 'h',
    });
    prisma.emailCampaign.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.startSending('c1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
