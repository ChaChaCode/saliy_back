import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Создаём пул и адаптер
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log('🌱 Начинаем заполнение базы данных...\n');

  try {
    // 1. Создаём категорию "Джинсовки"
    console.log('📁 Создаём категорию "Джинсовки"...');
    const category = await prisma.category.upsert({
      where: { slug: 'dzhinsovki' },
      update: {},
      create: {
        name: 'Джинсовки',
        slug: 'dzhinsovki',
        type: 'TOP',
        isActive: true,
        desktopBannerUrl: 'categories/IMG_7023.jpg',
        mobileBannerUrl: 'categories/IMG_7039.jpg',
      },
    });
    console.log(`✅ Категория создана: ${category.name} (ID: ${category.id})\n`);

    // 2. Создаём товар: Джинсовка SALIY чёрная
    console.log('👕 Создаём товар: Джинсовка SALIY чёрная...');
    const blackDzhinsovka = await prisma.product.upsert({
      where: { slug: 'dzhinsovka-saliy-black' },
      update: {
      },
      create: {
        name: 'Джинсовка SALIY чёрная',
        slug: 'dzhinsovka-saliy-black',
        description: '— 100% ХЛОПОК\n— ТУРЕЦКАЯ ДЖИНСА\n— ПЛОТНОСТЬ 550Г\n— ДВА БОКОВЫХ КАРМАНА',
        cardStatus: 'NEW',
        gender: 'unisex',
        color: 'black',
        weight: 550,
        price: 9500,
        discount: 0,
        images: [
          {
            url: 'products/dzhinsovka-black/Глеб фото 2.jpg',
            isPreview: true,
            previewOrder: 1,
          },
          {
            url: 'products/dzhinsovka-black/Глеб фото 3.jpg',
            isPreview: true,
            previewOrder: 2,
          },
          {
            url: 'products/dzhinsovka-black/Глеб фото 5.jpg',
            isPreview: false,
            previewOrder: null,
          },
        ],
        stock: {
          S: Math.floor(Math.random() * 10) + 5,   // 5-14 шт
          M: Math.floor(Math.random() * 10) + 5,   // 5-14 шт
          L: Math.floor(Math.random() * 10) + 5,   // 5-14 шт
          XL: Math.floor(Math.random() * 10) + 5,  // 5-14 шт
        },
        isActive: true,
        categories: {
          create: [{ categoryId: category.id }],
        },
      },
    });
    console.log(`✅ Товар создан: ${blackDzhinsovka.name} (ID: ${blackDzhinsovka.id})`);
    console.log(`   Остатки: S=${(blackDzhinsovka.stock as any).S}, M=${(blackDzhinsovka.stock as any).M}, L=${(blackDzhinsovka.stock as any).L}, XL=${(blackDzhinsovka.stock as any).XL}\n`);

    // 3. Создаём товар: Джинсовка SALIY синяя
    console.log('👕 Создаём товар: Джинсовка SALIY синяя...');
    const blueDzhinsovka = await prisma.product.upsert({
      where: { slug: 'dzhinsovka-saliy-blue' },
      update: {
      },
      create: {
        name: 'Джинсовка SALIY синяя',
        slug: 'dzhinsovka-saliy-blue',
        description: '— 100% ХЛОПОК\n— ТУРЕЦКАЯ ДЖИНСА\n— ПЛОТНОСТЬ 550Г\n— ДВА БОКОВЫХ КАРМАНА',
        cardStatus: 'NEW',
        gender: 'unisex',
        color: 'blue',
        weight: 550,
        price: 9500,
        discount: 0,
        images: [
          {
            url: 'products/dzhinsovka-blue/Глеб фото син 1.jpg',
            isPreview: true,
            previewOrder: 1,
          },
          {
            url: 'products/dzhinsovka-blue/Глеб фото син 2.jpg',
            isPreview: true,
            previewOrder: 2,
          },
          {
            url: 'products/dzhinsovka-blue/Глеб фото син 3.jpg',
            isPreview: false,
            previewOrder: null,
          },
          {
            url: 'products/dzhinsovka-blue/Глеб фото син 4.jpg',
            isPreview: false,
            previewOrder: null,
          },
        ],
        stock: {
          S: Math.floor(Math.random() * 10) + 5,   // 5-14 шт
          M: Math.floor(Math.random() * 10) + 5,   // 5-14 шт
          L: Math.floor(Math.random() * 10) + 5,   // 5-14 шт
          XL: Math.floor(Math.random() * 10) + 5,  // 5-14 шт
        },
        isActive: true,
        categories: {
          create: [{ categoryId: category.id }],
        },
      },
    });
    console.log(`✅ Товар создан: ${blueDzhinsovka.name} (ID: ${blueDzhinsovka.id})`);
    console.log(`   Остатки: S=${(blueDzhinsovka.stock as any).S}, M=${(blueDzhinsovka.stock as any).M}, L=${(blueDzhinsovka.stock as any).L}, XL=${(blueDzhinsovka.stock as any).XL}\n`);

    // 4. Создаём баннеры главной страницы
    console.log('🎨 Создаём баннеры главной страницы...');

    const banner1 = await prisma.banner.create({
      data: {
        title: 'Новая коллекция джинсовок SALIY',
        description: 'Качественные джинсовки из турецкой джинсы',
        desktopImageUrl: 'banners/photo_2026-03-22_01-03-37.jpg',
        mobileImageUrl: 'banners/photo_2026-03-22_01-03-37.jpg',
        link: '/categories/dzhinsovki',
        order: 0,
        isActive: true,
      },
    });
    console.log(`✅ Баннер 1 создан: ${banner1.title}`);

    const banner2 = await prisma.banner.create({
      data: {
        title: 'SALIY - твой стиль',
        description: 'Стильные джинсовки для любого случая',
        desktopImageUrl: 'banners/235235.jpg',
        mobileImageUrl: 'banners/235235.jpg',
        link: '/products',
        order: 1,
        isActive: true,
      },
    });
    console.log(`✅ Баннер 2 создан: ${banner2.title}\n`);

    console.log('✅ База данных успешно заполнена!\n');
    console.log('📊 Итого:');
    console.log(`   - Категорий: 1`);
    console.log(`   - Товаров: 2`);
    console.log(`   - Баннеров: 2`);
    console.log(`\n🔗 Проверить:`);
    console.log(`   - Товары: https://saliy-shop.ru/api/products`);
    console.log(`   - Баннеры: https://saliy-shop.ru/api/banners/active`);
    console.log(`   - Категория: https://saliy-shop.ru/api/categories/dzhinsovki`);
  } catch (error: any) {
    console.error('❌ Ошибка при заполнении БД:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
