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
  console.log('Fixing dates with SQL...');

  // Исправляем products
  await prisma.$executeRaw`
    UPDATE products
    SET
      created_at = COALESCE(updated_at, NOW()),
      updated_at = COALESCE(updated_at, NOW())
    WHERE created_at IS NULL OR updated_at IS NULL
  `;
  console.log('Fixed products');

  // Исправляем categories
  await prisma.$executeRaw`
    UPDATE categories
    SET
      created_at = COALESCE(updated_at, NOW()),
      updated_at = COALESCE(updated_at, NOW())
    WHERE created_at IS NULL OR updated_at IS NULL
  `;
  console.log('Fixed categories');

  // Исправляем product_categories
  await prisma.$executeRaw`
    UPDATE product_categories
    SET
      created_at = COALESCE(created_at, NOW())
    WHERE created_at IS NULL
  `;
  console.log('Fixed product_categories');

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
