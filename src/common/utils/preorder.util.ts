import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type AvailabilityProduct = {
  cardStatus?: string;
  stock: unknown;
  preorderStock?: unknown;
};

export function purchaseAvailability(
  product: AvailabilityProduct,
  size: string,
) {
  const isPreorder = product.cardStatus === 'PRE_ORDER';
  const source = (isPreorder ? product.preorderStock : product.stock) as Record<
    string,
    number
  > | null;
  const value = source?.[size];
  return {
    isPreorder,
    availableQuantity:
      Number.isSafeInteger(value) && value! > 0 ? value! : 0,
  };
}

export function validatePreorderConfig(product: AvailabilityProduct) {
  if (product.preorderStock != null) {
    if (
      typeof product.preorderStock !== 'object' ||
      Array.isArray(product.preorderStock) ||
      Object.values(product.preorderStock).some(
        (v) => !Number.isSafeInteger(v) || v < 0,
      )
    ) {
      throw new BadRequestException(
        'Лимиты предзаказа должны быть целыми неотрицательными числами',
      );
    }
  }

}

export const waitingForPreorder = (order: {
  items: Array<{ isPreorder?: boolean; preorderReady?: boolean }>;
}) => order.items.some((item) => item.isPreorder && !item.preorderReady);

// Lock all products in a stable order before reading/modifying JSON counters.
export async function lockProducts(
  tx: Prisma.TransactionClient,
  ids: number[],
) {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  if (unique.length)
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM products WHERE id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`,
    );
}

export async function changeReservedQuantity(
  tx: Prisma.TransactionClient,
  item: {
    productId: number;
    size: string;
    quantity: number;
    isPreorder?: boolean;
    preorderReady?: boolean;
  },
  release = false,
) {
  await lockProducts(tx, [item.productId]);
  const product = await tx.product.findUnique({
    where: { id: item.productId },
  });
  if (!product) {
    if (release) return;
    throw new BadRequestException('Товар не найден');
  }
  const field =
    item.isPreorder && !item.preorderReady ? 'preorderStock' : 'stock';
  const stock = { ...((product[field] as Record<string, number>) || {}) };
  const current = stock[item.size] || 0;
  if (!release && current < item.quantity) {
    throw new BadRequestException(
      `${product.name} (${item.size}): доступно только ${current} шт`,
    );
  }
  stock[item.size] = current + (release ? item.quantity : -item.quantity);
  await tx.product.update({
    where: { id: product.id },
    data: {
      [field]: stock,
      salesCount: { increment: release ? -item.quantity : item.quantity },
    },
  });
}
