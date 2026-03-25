# 📦 Структура товаров и категорий

## Обзор

Реализована база данных для товаров с поддержкой:
- Мультиязычности (RU, EN, PL)
- Множественных категорий для одного товара
- JSON-структур для изображений, цен и остатков
- Счётчиков просмотров и продаж
- Статусов карточек товара

---

## 🗄️ Структура базы данных

### 1. Category (Категории)

```prisma
model Category {
  id        Int             @id @default(autoincrement())
  name      String          @unique        // Название (RU)
  nameEn    String?                       // Название (EN)
  namePl    String?                       // Название (PL)
  slug      String          @unique        // URL-slug (например: "hoodies")
  type      category_type   @default(OTHER) // Тип: TOP, BOTTOM, ACCESSORIES, SPORT, OTHER
  isActive  Boolean         @default(true)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  products  ProductCategory[]
}
```

**Примеры категорий:**
```typescript
{
  name: "Толстовки",
  nameEn: "Hoodies",
  namePl: "Bluzy z kapturem",
  slug: "hoodies",
  type: "TOP",
  isActive: true
}
```

---

### 2. Product (Товары)

```prisma
model Product {
  id            Int           @id @default(autoincrement())

  // Название (мультиязычность)
  name          String                    // Название (RU)
  nameEn        String?                   // Название (EN)
  namePl        String?                   // Название (PL)
  slug          String        @unique     // URL-slug (например: "black-hoodie-v2")

  // Описание (мультиязычность)
  description   String?                   // Описание (RU)
  descriptionEn String?                   // Описание (EN)
  descriptionPl String?                   // Описание (PL)

  // Характеристики
  cardStatus    card_status   @default(NONE) // NONE, NEW, SALE, SOLD_OUT, PRE_ORDER, COMING_SOON
  gender        gender_type   @default(unisex) // male, female, unisex
  weight        Float?                    // Вес в граммах (для расчёта доставки)

  // JSON структуры
  images        Json          @default("{}") // Изображения по цветам
  prices        Json          @default("{}") // Цены по валютам
  stock         Json          @default("{}") // Остатки по цветам и размерам

  // Счётчики
  isActive      Boolean       @default(true)
  viewCount     Int           @default(0)
  salesCount    Int           @default(0)

  // Даты
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // Связи
  categories    ProductCategory[]
  orderItems    OrderItem[]
}
```

---

### 3. ProductCategory (Связь товаров и категорий)

```prisma
model ProductCategory {
  id         Int      @id @default(autoincrement())
  productId  Int
  categoryId Int
  createdAt  DateTime @default(now())

  category   Category @relation(...)
  product    Product  @relation(...)

  @@unique([productId, categoryId])
}
```

Один товар может быть в нескольких категориях (например, толстовка может быть в "Толстовки", "Новинки", "Распродажа").

---

## 📊 JSON структуры

### 1. Images (Изображения)

Структура: `{ [color: string]: ImageObject[] }`

```json
{
  "black": [
    {
      "url": "products/1772497009334/black_0_47ed4877.jpg",
      "isPreview": true,
      "previewOrder": 1
    },
    {
      "url": "products/1772497009334/black_1_3701058f.jpg",
      "isPreview": true,
      "previewOrder": 2
    },
    {
      "url": "products/1772497009334/black_2_f215c576.jpg",
      "isPreview": false,
      "previewOrder": null
    }
  ],
  "white": [
    {
      "url": "products/1772497009334/white_0_abc123.jpg",
      "isPreview": true,
      "previewOrder": 1
    }
  ]
}
```

**Поля:**
- `url` — путь к изображению
- `isPreview` — показывать ли в превью на карточке
- `previewOrder` — порядок в превью (1, 2, ...)

---

### 2. Prices (Цены)

Структура: `{ [currency: string]: { price: number, discount: number } }`

```json
{
  "RUB": {
    "price": 6300,
    "discount": 0
  },
  "BYN": {
    "price": 214,
    "discount": 10
  },
  "EUR": {
    "price": 65,
    "discount": 5
  }
}
```

**Поля:**
- `price` — полная цена
- `discount` — скидка в процентах (0-100)

**Итоговая цена:**
```typescript
const finalPrice = price - (price * discount / 100);
// Пример: 214 - (214 * 10 / 100) = 192.6 BYN
```

---

### 3. Stock (Остатки)

Структура: `{ [color: string]: { [size: string]: number } }`

```json
{
  "black": {
    "XS": 10,
    "S": 0,
    "M": 5,
    "L": 10,
    "XL": 3
  },
  "white": {
    "S": 5,
    "M": 2,
    "L": 0
  }
}
```

**Значения:**
- `> 0` — в наличии (указанное количество)
- `0` — нет в наличии

---

## 🎨 Enum'ы

### card_status (Статус карточки)

```typescript
enum card_status {
  NONE         // Без статуса
  NEW          // Новинка
  SALE         // Распродажа
  SOLD_OUT     // Распродано
  PRE_ORDER    // Предзаказ
  COMING_SOON  // Скоро в продаже
}
```

На фронтенде можно показывать бейджи:
- 🆕 NEW — зелёный
- 🔥 SALE — красный
- ❌ SOLD_OUT — серый
- 📦 PRE_ORDER — синий
- ⏳ COMING_SOON — оранжевый

---

### gender_type (Пол)

```typescript
enum gender_type {
  male         // Мужской
  female       // Женский
  unisex       // Унисекс
}
```

Используется для фильтрации товаров.

---

### category_type (Тип категории)

```typescript
enum category_type {
  TOP          // Верхняя одежда
  BOTTOM       // Нижняя одежда
  ACCESSORIES  // Аксессуары
  SPORT        // Спортивная одежда
  OTHER        // Другое
}
```

Помогает группировать категории в меню.

---

## 📝 Примеры создания данных

### Создание категории

```typescript
const category = await prisma.category.create({
  data: {
    name: 'Толстовки',
    nameEn: 'Hoodies',
    namePl: 'Bluzy z kapturem',
    slug: 'hoodies',
    type: 'TOP',
    isActive: true,
  },
});
```

---

### Создание товара

```typescript
const product = await prisma.product.create({
  data: {
    name: 'Чёрная толстовка V2',
    nameEn: 'Black Hoodie V2',
    namePl: 'Czarna bluza V2',
    slug: 'black-hoodie-v2',

    description: 'Премиальная толстовка из плотного хлопка',
    descriptionEn: 'Premium hoodie made of thick cotton',
    descriptionPl: 'Bluza premium z grubej bawełny',

    cardStatus: 'NEW',
    gender: 'unisex',
    weight: 500, // грамм

    images: {
      black: [
        {
          url: 'products/123/black_0.jpg',
          isPreview: true,
          previewOrder: 1,
        },
        {
          url: 'products/123/black_1.jpg',
          isPreview: true,
          previewOrder: 2,
        },
      ],
    },

    prices: {
      RUB: { price: 6300, discount: 0 },
      BYN: { price: 214, discount: 10 },
      EUR: { price: 65, discount: 0 },
    },

    stock: {
      black: { S: 10, M: 5, L: 10, XL: 3 },
    },

    isActive: true,
    viewCount: 0,
    salesCount: 0,

    // Связываем с категориями
    categories: {
      create: [
        { categoryId: 1 }, // Толстовки
        { categoryId: 5 }, // Новинки
      ],
    },
  },
});
```

---

### Получение товара с категориями

```typescript
const product = await prisma.product.findUnique({
  where: { slug: 'black-hoodie-v2' },
  include: {
    categories: {
      include: {
        category: true,
      },
    },
  },
});

// Результат:
{
  id: 1,
  name: 'Чёрная толстовка V2',
  slug: 'black-hoodie-v2',
  // ...
  categories: [
    {
      id: 1,
      category: { id: 1, name: 'Толстовки', slug: 'hoodies', ... }
    },
    {
      id: 2,
      category: { id: 5, name: 'Новинки', slug: 'new', ... }
    }
  ]
}
```

---

### Получение товаров категории

```typescript
const products = await prisma.product.findMany({
  where: {
    isActive: true,
    categories: {
      some: {
        category: {
          slug: 'hoodies',
        },
      },
    },
  },
  include: {
    categories: {
      include: {
        category: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

---

### Увеличение счётчиков

```typescript
// Увеличить просмотры
await prisma.product.update({
  where: { id: productId },
  data: {
    viewCount: { increment: 1 },
  },
});

// Увеличить продажи
await prisma.product.update({
  where: { id: productId },
  data: {
    salesCount: { increment: quantity },
  },
});
```

---

### Обновление остатков после продажи

```typescript
const product = await prisma.product.findUnique({
  where: { id: productId },
});

const stock = product.stock as { [color: string]: { [size: string]: number } };

// Уменьшаем остатки
stock[color][size] -= quantity;

await prisma.product.update({
  where: { id: productId },
  data: { stock },
});
```

---

## 🔍 Полезные запросы

### Товары на главную (популярные)

```typescript
const popular = await prisma.product.findMany({
  where: { isActive: true },
  orderBy: { salesCount: 'desc' },
  take: 10,
  include: {
    categories: {
      include: { category: true },
    },
  },
});
```

---

### Товары в распродаже

```typescript
const saleProducts = await prisma.product.findMany({
  where: {
    isActive: true,
    cardStatus: 'SALE',
  },
  include: {
    categories: {
      include: { category: true },
    },
  },
});
```

---

### Поиск товаров

```typescript
const searchResults = await prisma.product.findMany({
  where: {
    isActive: true,
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { nameEn: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ],
  },
});
```

---

### Фильтрация товаров

```typescript
const filtered = await prisma.product.findMany({
  where: {
    isActive: true,
    gender: 'unisex',
    cardStatus: { in: ['NEW', 'SALE'] },
    categories: {
      some: {
        category: {
          type: 'TOP',
        },
      },
    },
  },
});
```

---

## 🚀 API Endpoints (будущие)

### GET /api/products
Получить список товаров с фильтрацией

**Query параметры:**
- `category` — slug категории
- `gender` — male/female/unisex
- `status` — NEW, SALE, ...
- `sort` — createdAt, salesCount, viewCount
- `limit` — количество
- `offset` — смещение

---

### GET /api/products/:slug
Получить конкретный товар

**Ответ:**
```json
{
  "id": 1,
  "name": "Чёрная толстовка V2",
  "slug": "black-hoodie-v2",
  "description": "Премиальная толстовка...",
  "cardStatus": "NEW",
  "gender": "unisex",
  "weight": 500,
  "images": {...},
  "prices": {...},
  "stock": {...},
  "categories": [
    {
      "id": 1,
      "name": "Толстовки",
      "slug": "hoodies"
    }
  ]
}
```

---

### GET /api/categories
Получить список всех категорий

---

### GET /api/categories/:slug/products
Получить товары категории

---

## 📋 Следующие шаги

1. ✅ Структура БД создана
2. ⏳ Создать ProductsService
3. ⏳ Создать ProductsController с API endpoints
4. ⏳ Добавить загрузку изображений
5. ⏳ Реализовать поиск и фильтрацию
6. ⏳ Добавить админ-панель для управления товарами

---

**Дата:** 2026-03-25
**Версия:** 1.0
