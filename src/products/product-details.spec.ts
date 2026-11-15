import { ValidationPipe } from '@nestjs/common';
import {
  CreateProductDto as AdminCreateProductDto,
  UpdateProductDto as AdminUpdateProductDto,
} from '../admin/products/dto/admin-product.dto';
import { CreateProductDto, UpdateProductDto } from './products.dto';

describe.each([
  AdminCreateProductDto,
  AdminUpdateProductDto,
  CreateProductDto,
  UpdateProductDto,
])('%p product details validation', (metatype) => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const parse = (details: object) =>
    pipe.transform(
      { name: 'Test', slug: 'test', price: 100, ...details },
      { type: 'body', metatype },
    );

  it('keeps multiline details through request whitelisting', async () => {
    const details = {
      modelParameters: 'Рост 175 см\nРазмер S',
      compositionCare: '100% хлопок\nСтирка при 30 °C',
    };
    expect(await parse(details)).toMatchObject(details);
  });

  it('allows existing clients to omit details', async () => {
    const result = await parse({});
    expect(result.modelParameters).toBeUndefined();
    expect(result.compositionCare).toBeUndefined();
  });

  it.each(['modelParameters', 'compositionCare'])(
    'validates and allows clearing %s',
    async (field) => {
      for (const value of [null, '', 'a'.repeat(3000)]) {
        expect(await parse({ [field]: value })).toHaveProperty(field, value);
      }
      for (const value of ['a'.repeat(3001), 123, {}, ['text']]) {
        await expect(parse({ [field]: value })).rejects.toThrow();
      }
    },
  );
});
