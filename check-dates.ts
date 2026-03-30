import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Загружаем .env
dotenv.config();

// Создаём пул соединений
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function checkDates() {
  console.log('Checking dates in database...\n');

  // Проверяем один продукт напрямую через SQL
  const result = await prisma.$queryRaw`
    SELECT id, name, slug, created_at, updated_at, pg_typeof(created_at) as created_at_type
    FROM products
    WHERE slug = 'dzhinsovka-saliy-black'
    LIMIT 1
  `;

  console.log('Product data from SQL:');
  console.log(JSON.stringify(result, null, 2));

  // Проверяем через Prisma ORM
  const product = await prisma.product.findUnique({
    where: { slug: 'dzhinsovka-saliy-black' },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log('\nProduct data from Prisma ORM:');
  console.log(JSON.stringify(product, null, 2));
}

checkDates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
