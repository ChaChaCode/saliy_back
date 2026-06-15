/**
 * Одноразовый скрипт: удалить ВСЕ заказы.
 * Запуск на сервере: npx ts-node delete_all_orders.ts
 *
 * OrderItem удаляются каскадом (onDelete: Cascade).
 * PromoCodeUsage не удаляются — у них orderId обнуляется (onDelete: SetNull).
 * Сток товаров НЕ восстанавливается (заказы тестовые).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.order.count();
  console.log(`Заказов в базе: ${before}`);

  const result = await prisma.order.deleteMany({});
  console.log(`Удалено заказов: ${result.count}`);

  const after = await prisma.order.count();
  console.log(`Осталось заказов: ${after}`);
}

main()
  .catch((e) => {
    console.error('Ошибка удаления заказов:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
