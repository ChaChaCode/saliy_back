import { BadRequestException } from '@nestjs/common';

export function validateProductPrices(product: {
  price: number;
  oldPrice?: number | null;
  discount?: number;
}): void {
  if (product.oldPrice == null) return;
  if (!Number.isFinite(product.oldPrice) || product.oldPrice <= product.price) {
    throw new BadRequestException('Старая цена должна быть больше актуальной');
  }
  if ((product.discount ?? 0) !== 0) {
    throw new BadRequestException('Укажите актуальную цену без дополнительной процентной скидки');
  }
}
