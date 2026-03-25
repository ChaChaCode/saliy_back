// Скрипт для добавления тестовых товаров и категорий
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

// Создаём пул и адаптер
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...\n');

  // 1. Создаём категории
  console.log('📁 Создаём категории...');

  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Толстовки',
        slug: 'hoodies',
        type: 'TOP',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Футболки',
        slug: 'tshirts',
        type: 'TOP',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Штаны',
        slug: 'pants',
        type: 'BOTTOM',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Аксессуары',
        slug: 'accessories',
        type: 'ACCESSORIES',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Новинки',
        slug: 'new',
        type: 'OTHER',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Распродажа',
        slug: 'sale',
        type: 'OTHER',
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Создано ${categories.length} категорий\n`);

  // 2. Создаём товары
  console.log('📦 Создаём товары...');

  // Товар 1: Чёрная толстовка
  const hoodie1 = await prisma.product.create({
    data: {
      name: 'Чёрная толстовка оверсайз',
      slug: 'black-oversized-hoodie',

      description: 'Премиальная толстовка из плотного хлопка 380 г/м². Свободный крой, мягкий флис внутри.',

      cardStatus: 'NEW',
      gender: 'unisex',
      color: 'black',
      weight: 650,
      price: 6300,
      discount: 0,

      images: [
        {
          url: 'products/hoodie-black/front.jpg',
          isPreview: true,
          previewOrder: 1,
        },
        {
          url: 'products/hoodie-black/back.jpg',
          isPreview: true,
          previewOrder: 2,
        },
        {
          url: 'products/hoodie-black/side.jpg',
          isPreview: false,
          previewOrder: null,
        },
      ],

      stock: {
        XS: 5,
        S: 10,
        M: 15,
        L: 10,
        XL: 5,
      },

      isActive: true,
      viewCount: 0,
      salesCount: 0,

      categories: {
        create: [
          { categoryId: categories[0].id }, // Толстовки
          { categoryId: categories[4].id }, // Новинки
        ],
      },
    },
  });

  console.log(`✅ Создан товар: ${hoodie1.name}`);

  // Товар 2: Белая футболка
  const tshirt1 = await prisma.product.create({
    data: {
      name: 'Белая футболка базовая',
      slug: 'white-basic-tshirt',

      description: 'Классическая футболка из 100% хлопка. Идеальная посадка, плотность 180 г/м².',

      cardStatus: 'SALE',
      gender: 'unisex',
      color: 'white',
      weight: 200,
      price: 2500,
      discount: 20, // 20% скидка = 2000 руб

      images: [
        {
          url: 'products/tshirt-white/front.jpg',
          isPreview: true,
          previewOrder: 1,
        },
        {
          url: 'products/tshirt-white/back.jpg',
          isPreview: true,
          previewOrder: 2,
        },
      ],

      stock: {
        XS: 3,
        S: 8,
        M: 12,
        L: 8,
        XL: 2,
      },

      isActive: true,
      viewCount: 120,
      salesCount: 45,

      categories: {
        create: [
          { categoryId: categories[1].id }, // Футболки
          { categoryId: categories[5].id }, // Распродажа
        ],
      },
    },
  });

  console.log(`✅ Создан товар: ${tshirt1.name}`);

  // Товар 3: Чёрные карго штаны
  const pants1 = await prisma.product.create({
    data: {
      name: 'Чёрные карго штаны',
      slug: 'black-cargo-pants',

      description: 'Тактические штаны с множеством карманов. Прочная ткань рипстоп.',

      cardStatus: 'NONE',
      gender: 'male',
      color: 'black',
      weight: 500,
      price: 5800,
      discount: 0,

      images: [
        {
          url: 'products/pants-cargo-black/front.jpg',
          isPreview: true,
          previewOrder: 1,
        },
        {
          url: 'products/pants-cargo-black/detail.jpg',
          isPreview: true,
          previewOrder: 2,
        },
      ],

      stock: {
        S: 0, // Нет в наличии
        M: 5,
        L: 10,
        XL: 7,
      },

      isActive: true,
      viewCount: 85,
      salesCount: 23,

      categories: {
        create: [
          { categoryId: categories[2].id }, // Штаны
        ],
      },
    },
  });

  console.log(`✅ Создан товар: ${pants1.name}`);

  // Товар 4: Кепка
  const cap1 = await prisma.product.create({
    data: {
      name: 'Чёрная кепка с вышивкой',
      slug: 'black-cap-embroidery',

      description: 'Классическая бейсболка с регулируемым ремешком. Вышитый логотип.',

      cardStatus: 'NONE',
      gender: 'unisex',
      color: 'black',
      weight: 100,
      price: 1500,
      discount: 0,

      images: [
        {
          url: 'products/cap-black/front.jpg',
          isPreview: true,
          previewOrder: 1,
        },
        {
          url: 'products/cap-black/side.jpg',
          isPreview: true,
          previewOrder: 2,
        },
      ],

      stock: {
        'ONE SIZE': 25,
      },

      isActive: true,
      viewCount: 340,
      salesCount: 112,

      categories: {
        create: [
          { categoryId: categories[3].id }, // Аксессуары
        ],
      },
    },
  });

  console.log(`✅ Создан товар: ${cap1.name}`);

  console.log('\n🎉 База данных успешно заполнена!');
  console.log(`\nСоздано:`);
  console.log(`  📁 Категорий: ${categories.length}`);
  console.log(`  📦 Товаров: 4`);
  console.log(`\nПримеры slug'ов для проверки:`);
  console.log(`  - /products/black-oversized-hoodie`);
  console.log(`  - /products/white-basic-tshirt`);
  console.log(`  - /products/black-cargo-pants`);
  console.log(`  - /products/black-cap-embroidery`);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
