import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function cleanup() {
  console.log('🗑️  Удаляем старые записи...\n');

  try {
    // Удаляем товары
    await prisma.product.deleteMany({
      where: {
        slug: {
          in: ['dzhinsovka-saliy-black', 'dzhinsovka-saliy-blue'],
        },
      },
    });
    console.log('✅ Товары удалены');

    // Удаляем категорию
    await prisma.category.deleteMany({
      where: {
        slug: 'dzhinsovki',
      },
    });
    console.log('✅ Категория удалена');

    // Удаляем баннеры
    await prisma.banner.deleteMany({
      where: {
        title: {
          in: ['Новая коллекция джинсовок SALIY', 'SALIY - твой стиль'],
        },
      },
    });
    console.log('✅ Баннеры удалены');

    console.log('\n✅ Очистка завершена!');
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
