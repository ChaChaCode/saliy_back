import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

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
  });
