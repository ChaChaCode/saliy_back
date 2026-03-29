import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Получаем последний код для test@saliy.com
  const code = await prisma.verificationCode.findFirst({
    where: { email: 'test@saliy.com' },
    orderBy: { createdAt: 'desc' },
  });

  if (code) {
    console.log('Код верификации:', code.code);
    console.log('\nТеперь выполни:');
    console.log(`curl -X POST "https://saliy-shop.ru/api/auth/verify" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"email": "test@saliy.com", "code": "${code.code}"}'`);
  } else {
    console.log('Код не найден');
  }

  await prisma.$disconnect();
}

main();
