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

async function fixDates() {
  console.log('Fixing dates...');

  // Обновляем products - просто триггерим updatedAt
  const productsUpdated = await prisma.product.updateMany({
    where: {},
    data: {
      updatedAt: new Date(),
    },
  });
  console.log(`Updated ${productsUpdated.count} products`);

  // Обновляем categories
  const categoriesUpdated = await prisma.category.updateMany({
    where: {},
    data: {
      updatedAt: new Date(),
    },
  });
  console.log(`Updated ${categoriesUpdated.count} categories`);

  console.log('Done!');
}

fixDates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
