// Очистка базы данных
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🗑️  Очистка базы данных...\n');

  // Удаляем товары (каскадно удалятся и связи с категориями)
  const deletedProducts = await prisma.product.deleteMany({});
  console.log(`✅ Удалено товаров: ${deletedProducts.count}`);

  // Удаляем категории
  const deletedCategories = await prisma.category.deleteMany({});
  console.log(`✅ Удалено категорий: ${deletedCategories.count}`);

  console.log('\n✅ База данных очищена!');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
