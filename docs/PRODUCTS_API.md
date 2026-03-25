# 📦 Products API Documentation

## Обзор

REST API для работы с товарами. Все endpoint'ы доступны по базовому пути `/api/products`.

---

## 📋 Список endpoint'ов

### 1. Получить все товары (с фильтрацией)

**GET** `/api/products`

**Query параметры:**
- `categorySlug` (string) — slug категории
- `gender` (enum) — male | female | unisex
- `status` (enum) — NONE | NEW | SALE | SOLD_OUT | PRE_ORDER | COMING_SOON
- `minPrice` (number) — минимальная цена
- `maxPrice` (number) — максимальная цена
- `inStock` (boolean) — только товары в наличии
- `sortBy` (string) — createdAt | salesCount | viewCount | name
- `sortOrder` (string) — asc | desc
- `limit` (number) — количество товаров (по умолчанию 20)
- `offset` (number) — смещение (по умолчанию 0)

**Примеры:**
```bash
# Все товары
curl http://localhost:3000/api/products

# Толстовки
curl http://localhost:3000/api/products?categorySlug=hoodies

# Мужские товары
curl http://localhost:3000/api/products?gender=male

# Новинки
curl http://localhost:3000/api/products?status=NEW

# Товары в наличии
curl http://localhost:3000/api/products?inStock=true

# Сортировка по продажам
curl http://localhost:3000/api/products?sortBy=salesCount&sortOrder=desc

# Комбинация фильтров
curl "http://localhost:3000/api/products?categorySlug=hoodies&gender=unisex&limit=10"
```

**Ответ:**
```json
{
  "products": [
    {
      "id": 1,
      "name": "Чёрная толстовка оверсайз",
      "slug": "black-oversized-hoodie",
      "description": "Премиальная толстовка...",
      "cardStatus": "NEW",
      "gender": "unisex",
      "weight": 650,
      "images": { "black": [...] },
      "prices": { "RUB": { "price": 6300, "discount": 0 } },
      "stock": { "black": { "S": 10, "M": 15, "L": 10 } },
      "isActive": true,
      "viewCount": 1,
      "salesCount": 0,
      "categories": [
        {
          "id": 1,
          "category": {
            "id": 1,
            "name": "Толстовки",
            "slug": "hoodies"
          }
        }
      ]
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### 2. Получить товар по slug

**GET** `/api/products/:slug`

**Параметры:**
- `slug` (string, path) — уникальный slug товара

**Пример:**
```bash
curl http://localhost:3000/api/products/black-oversized-hoodie
```

**Ответ:**
```json
{
  "id": 1,
  "name": "Чёрная толстовка оверсайз",
  "slug": "black-oversized-hoodie",
  "description": "Премиальная толстовка...",
  "cardStatus": "NEW",
  "gender": "unisex",
  "weight": 650,
  "images": {...},
  "prices": {...},
  "stock": {...},
  "viewCount": 1,
  "salesCount": 0,
  "categories": [...]
}
```

**Примечание:** При каждом просмотре счётчик `viewCount` увеличивается на 1.

---

### 3. Поиск товаров

**GET** `/api/products/search`

**Query параметры:**
- `q` (string, обязательный) — поисковый запрос (минимум 2 символа)
- `lang` (string) — язык (ru | en | pl), по умолчанию ru

**Пример:**
```bash
curl http://localhost:3000/api/products/search?q=толстовка

curl http://localhost:3000/api/products/search?q=hoodie&lang=en
```

**Ответ:**
```json
[
  {
    "id": 1,
    "name": "Чёрная толстовка оверсайз",
    "slug": "black-oversized-hoodie",
    ...
  }
]
```

---

### 4. Популярные товары (топ продаж)

**GET** `/api/products/popular`

**Query параметры:**
- `limit` (number) — количество товаров (по умолчанию 10)

**Пример:**
```bash
curl http://localhost:3000/api/products/popular?limit=5
```

**Ответ:** Массив товаров, отсортированный по `salesCount` (убыванию).

---

### 5. Товары в распродаже

**GET** `/api/products/sale`

**Query параметры:**
- `limit` (number) — количество товаров (по умолчанию 20)

**Пример:**
```bash
curl http://localhost:3000/api/products/sale?limit=10
```

**Ответ:** Массив товаров со статусом `SALE`.

---

### 6. Новинки

**GET** `/api/products/new`

**Query параметры:**
- `limit` (number) — количество товаров (по умолчанию 20)

**Пример:**
```bash
curl http://localhost:3000/api/products/new?limit=10
```

**Ответ:** Массив товаров со статусом `NEW`.

---

### 7. Проверить наличие товара

**GET** `/api/products/:id/stock`

**Параметры:**
- `id` (number, path) — ID товара
- `color` (string, query) — цвет
- `size` (string, query) — размер

**Пример:**
```bash
curl "http://localhost:3000/api/products/1/stock?color=black&size=M"
```

**Ответ:**
```json
{
  "productId": 1,
  "color": "black",
  "size": "M",
  "inStock": true,
  "quantity": 15
}
```

---

### 8. Получить цену товара

**GET** `/api/products/:id/price`

**Параметры:**
- `id` (number, path) — ID товара
- `currency` (string, query) — валюта (RUB, BYN, EUR, USD), по умолчанию RUB

**Пример:**
```bash
curl "http://localhost:3000/api/products/1/price?currency=RUB"
```

**Ответ:**
```json
{
  "currency": "RUB",
  "originalPrice": 6300,
  "discount": 0,
  "finalPrice": 6300,
  "savings": 0
}
```

**С скидкой:**
```json
{
  "currency": "RUB",
  "originalPrice": 2500,
  "discount": 20,
  "finalPrice": 2000,
  "savings": 500
}
```

---

### 9. Получить все цены товара

**GET** `/api/products/:id/prices`

**Параметры:**
- `id` (number, path) — ID товара

**Пример:**
```bash
curl http://localhost:3000/api/products/1/prices
```

**Ответ:**
```json
[
  {
    "currency": "RUB",
    "originalPrice": 6300,
    "discount": 0,
    "finalPrice": 6300
  },
  {
    "currency": "BYN",
    "originalPrice": 214,
    "discount": 0,
    "finalPrice": 214
  },
  {
    "currency": "EUR",
    "originalPrice": 65,
    "discount": 0,
    "finalPrice": 65
  }
]
```

---

## 🔧 Административные endpoint'ы

### 10. Создать товар

**POST** `/api/products`

**Body:**
```json
{
  "name": "Новая толстовка",
  "slug": "new-hoodie",
  "description": "Описание товара",
  "cardStatus": "NEW",
  "gender": "unisex",
  "weight": 500,
  "images": {
    "black": [
      {
        "url": "products/new-hoodie/black_0.jpg",
        "isPreview": true,
        "previewOrder": 1
      }
    ]
  },
  "prices": {
    "RUB": { "price": 5000, "discount": 0 }
  },
  "stock": {
    "black": { "S": 10, "M": 15, "L": 10 }
  },
  "isActive": true,
  "categoryIds": [1, 5]
}
```

**Ответ:** Созданный товар с ID.

---

### 11. Обновить товар

**PUT** `/api/products/:id`

**Параметры:**
- `id` (number, path) — ID товара

**Body:** Частичное обновление (любые поля из CreateProductDto)
```json
{
  "name": "Обновлённое название",
  "cardStatus": "SALE",
  "prices": {
    "RUB": { "price": 5000, "discount": 20 }
  }
}
```

**Ответ:** Обновлённый товар.

---

### 12. Удалить товар

**DELETE** `/api/products/:id`

**Параметры:**
- `id` (number, path) — ID товара

**Пример:**
```bash
curl -X DELETE http://localhost:3000/api/products/1
```

**Ответ:** Удалённый товар.

---

## 📊 Примеры использования на фронтенде

### React/Next.js

```typescript
// Получить все товары категории
async function fetchProducts(categorySlug: string) {
  const res = await fetch(
    `http://localhost:3000/api/products?categorySlug=${categorySlug}`
  );
  const data = await res.json();
  return data.products;
}

// Получить товар по slug
async function fetchProduct(slug: string) {
  const res = await fetch(`http://localhost:3000/api/products/${slug}`);
  return res.json();
}

// Проверить наличие
async function checkStock(productId: number, color: string, size: string) {
  const res = await fetch(
    `http://localhost:3000/api/products/${productId}/stock?color=${color}&size=${size}`
  );
  const data = await res.json();
  return data.inStock;
}

// Получить цену со скидкой
async function getPrice(productId: number, currency: string = 'RUB') {
  const res = await fetch(
    `http://localhost:3000/api/products/${productId}/price?currency=${currency}`
  );
  const data = await res.json();
  return data.finalPrice;
}
```

---

## 🔍 Фильтрация и сортировка

### Примеры комплексных запросов

```bash
# Мужские толстовки в наличии, сортировка по продажам
curl "http://localhost:3000/api/products?categorySlug=hoodies&gender=male&inStock=true&sortBy=salesCount&sortOrder=desc"

# Товары в распродаже дешевле 3000 руб
curl "http://localhost:3000/api/products?status=SALE&maxPrice=3000"

# Новинки с пагинацией (страница 2, по 10 товаров)
curl "http://localhost:3000/api/products?status=NEW&limit=10&offset=10"
```

---

## ⚠️ Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Неверные параметры |
| 404 | Товар не найден |
| 500 | Внутренняя ошибка сервера |

**Примеры ошибок:**
```json
{
  "statusCode": 404,
  "message": "Товар \"non-existent-slug\" не найден",
  "error": "Not Found"
}
```

```json
{
  "statusCode": 400,
  "message": "Недостаточно товара на складе. Доступно: 5, запрошено: 10",
  "error": "Bad Request"
}
```

---

## 📈 Счётчики

### Автоматические счётчики:

1. **viewCount** — увеличивается при каждом просмотре товара (GET /products/:slug)
2. **salesCount** — увеличивается вручную через `ProductsService.incrementSalesCount()` при покупке

**Использование в OrdersService:**
```typescript
// После создания заказа
for (const item of order.items) {
  await this.productsService.incrementSalesCount(item.productId, item.quantity);
  await this.productsService.decreaseStock(
    item.productId,
    item.color,
    item.size,
    item.quantity
  );
}
```

---

## 🎯 Следующие шаги

1. ✅ API создан и протестирован
2. ⏳ Добавить загрузку изображений
3. ⏳ Добавить админ-панель
4. ⏳ Интегрировать с OrdersService
5. ⏳ Добавить корзину (CartService)

---

**Дата:** 2026-03-25
**Версия:** 1.0
