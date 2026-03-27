// Скрипт для создания первого администратора
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.admin.upsert({
    where: { id: 'admin-1' },
    update: {},
    create: {
      id: 'admin-1',
      name: 'Main Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Admin created:', admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
