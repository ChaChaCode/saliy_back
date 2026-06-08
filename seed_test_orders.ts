/**
 * Seed: тестовые заказы для проверки дашборда.
 *
 * Создаёт N заказов, раскиданных по последним ~75 дням (чтобы работала
 * метрика роста "этот месяц vs прошлый"), с разными статусами, способами
 * оплаты, типами доставки и товарами.
 *
 * Все тестовые заказы помечены префиксом orderNumber = "TEST-..." —
 * это позволяет легко их удалить:
 *   npx ts-node seed_test_orders.ts --clean
 *
 * Запуск создания:  npx ts-node seed_test_orders.ts
 * Запуск очистки:   npx ts-node seed_test_orders.ts --clean
 */
import 'dotenv/config';
import { PrismaClient, OrderStatus, PaymentMethod, DeliveryType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_PREFIX = 'TEST-';
const ORDERS_TO_CREATE = 40;

const STATUSES: OrderStatus[] = [
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'PENDING',
  'CANCELLED',
  'REFUNDED',
];
const PAYMENTS: PaymentMethod[] = [
  'CARD_ONLINE',
  'YANDEX_PAY',
  'CARD_MANUAL',
  'CRYPTO',
];
const DELIVERIES: DeliveryType[] = ['CDEK_PICKUP', 'STANDARD'];

const NAMES: Array<[string, string]> = [
  ['Иван', 'Петров'],
  ['Мария', 'Сидорова'],
  ['Алексей', 'Кузнецов'],
  ['Ольга', 'Смирнова'],
  ['Дмитрий', 'Волков'],
  ['Анна', 'Морозова'],
  ['Сергей', 'Новиков'],
  ['Екатерина', 'Орлова'],
];

// Псевдослучайность без Math.random (детерминированно по индексу).
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function clean() {
  const deleted = await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: TEST_PREFIX } },
  });
  console.log(`Удалено тестовых заказов: ${deleted.count}`);
}

async function seed() {
  // Берём реальные товары, если есть — чтобы ожили топ-товары и склад.
  const products = await prisma.product.findMany({
    take: 20,
    select: { id: true, name: true, price: true, discount: true },
  });
  console.log(`Найдено товаров в БД: ${products.length}`);

  const now = Date.now();
  let created = 0;

  for (let i = 0; i < ORDERS_TO_CREATE; i++) {
    const status = pick(STATUSES, i);
    const payment = pick(PAYMENTS, i + 1);
    const delivery = pick(DELIVERIES, i);
    const [firstName, lastName] = pick(NAMES, i);

    // Раскидываем по последним 75 дням (покрывает текущий + прошлый месяц).
    const daysAgo = (i * 73) % 75;
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    // 1-3 позиции в заказе.
    const itemsCount = (i % 3) + 1;
    const itemsData: Array<{
      productId: number | null;
      name: string;
      size: string;
      quantity: number;
      price: number;
      discount: number;
    }> = [];

    let subtotal = 0;
    for (let j = 0; j < itemsCount; j++) {
      const qty = (j % 2) + 1;
      let productId: number | null = null;
      let name: string;
      let price: number;
      let discount: number;

      if (products.length > 0) {
        const p = pick(products, i + j);
        productId = p.id;
        name = p.name;
        price = p.price || 3000;
        discount = p.discount || 0;
      } else {
        productId = null;
        name = `Тестовый товар ${j + 1}`;
        price = 2500 + j * 1000;
        discount = 0;
      }

      const finalPrice = Math.floor(price - (price * discount) / 100);
      subtotal += finalPrice * qty;
      itemsData.push({
        productId,
        name,
        size: pick(['S', 'M', 'L', 'XL'], i + j),
        quantity: qty,
        price,
        discount,
      });
    }

    const deliveryPrice = delivery === 'CDEK_PICKUP' ? 300 : 500;
    const total = subtotal + deliveryPrice;

    // PENDING/CANCELLED/REFUNDED — не считаем оплаченными (как в реальной логике).
    const isPaid = !['PENDING', 'CANCELLED', 'REFUNDED', 'PAYMENT_FAILED'].includes(
      status,
    );

    await prisma.order.create({
      data: {
        orderNumber: `${TEST_PREFIX}${String(1000 + i)}`,
        firstName,
        lastName,
        phone: `+7900${String(1000000 + i)}`,
        email: `test${i}@example.com`,
        deliveryType: delivery,
        deliveryPrice,
        paymentMethod: payment,
        currency: 'RUB',
        isPaid,
        subtotal,
        deliveryTotal: deliveryPrice,
        total,
        status,
        cityName: pick(['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург'], i),
        createdAt,
        updatedAt: createdAt,
        items: { create: itemsData },
      },
    });
    created++;
  }

  console.log(`Создано тестовых заказов: ${created}`);
  console.log(`Все помечены префиксом "${TEST_PREFIX}". Удалить: npx ts-node seed_test_orders.ts --clean`);
}

async function main() {
  const isClean = process.argv.includes('--clean');
  if (isClean) {
    await clean();
  } else {
    await seed();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
