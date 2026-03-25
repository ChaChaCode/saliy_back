# API товаров

## Структура товара

```typescript
{
  id: number;              // ID товара
  name: string;            // Название
  slug: string;            // URL slug (уникальный)
  description?: string;    // Описание

  // Характеристики
  cardStatus: card_status; // Статус карточки
  gender: gender_type;     // Пол
  color?: string;          // Цвет (black, white, red)
  weight?: number;         // Вес в граммах

  // Цена (только RUB)
  price: number;           // Цена в рублях
  discount: number;        // Скидка в процентах (0-100)

  // JSON поля
  images: Array;           // Массив изображений
  stock: Object;           // Остатки по размерам

  // Счётчики
  isActive: boolean;       // Активен ли товар
  viewCount: number;       // Количество просмотров
  salesCount: number;      // Количество продаж

  // Даты
  createdAt: Date;         // Дата создания
  updatedAt: Date;         // Дата обновления

  // Связи
  categories: Array;       // Категории товара
}
```

### Статусы карточки (card_status)
- `NONE` - Без статуса
- `NEW` - Новинка
- `SALE` - Распродажа
- `SOLD_OUT` - Распродано
- `PRE_ORDER` - Предзаказ
- `COMING_SOON` - Скоро в продаже

### Типы пола (gender_type)
- `male` - Мужской
- `female` - Женский
- `unisex` - Унисекс

### Формат images
```json
[
  {
    "url": "products/hoodie-black/front.jpg",
    "isPreview": true,
    "previewOrder": 1
  },
  {
    "url": "products/hoodie-black/back.jpg",
    "isPreview": true,
    "previewOrder": 2
  }
]
```

### Формат stock
```json
{
  "XS": 5,
  "S": 10,
  "M": 15,
  "L": 10,
  "XL": 5
}
```

---

## Эндпоинты

### 1. Получить список товаров

**GET** `/api/products`

**Query параметры:**
- `categorySlug` - Фильтр по категории
- `gender` - Фильтр по полу (male/female/unisex)
- `status` - Фильтр по статусу (NEW/SALE/etc)
- `minPrice` - Минимальная цена
- `maxPrice` - Максимальная цена
- `inStock` - Только товары в наличии (true/false)
- `sortBy` - Сортировка (createdAt/salesCount/viewCount/name)
- `sortOrder` - Порядок сортировки (asc/desc)
- `limit` - Количество товаров (по умолчанию 20)
- `offset` - Смещение для пагинации

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/products?categorySlug=hoodies&gender=unisex&limit=10"
```

**Пример ответа:**
```json
{
  "products": [
    {
      "id": 1,
      "name": "Чёрная толстовка оверсайз",
      "slug": "black-oversized-hoodie",
      "description": "Премиальная толстовка из плотного хлопка 380 г/м²",
      "cardStatus": "NEW",
      "gender": "unisex",
      "color": "black",
      "weight": 650,
      "price": 6300,
      "discount": 0,
      "images": [
        {
          "url": "products/hoodie-black/front.jpg",
          "isPreview": true,
          "previewOrder": 1
        }
      ],
      "stock": {
        "XS": 5,
        "S": 10,
        "M": 15,
        "L": 10,
        "XL": 5
      },
      "isActive": true,
      "viewCount": 0,
      "salesCount": 0,
      "categories": [
        {
          "category": {
            "id": 1,
            "name": "Толстовки",
            "slug": "hoodies"
          }
        }
      ],
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

### 2. Поиск товаров

**GET** `/api/products/search`

**Query параметры:**
- `q` - Поисковый запрос (минимум 2 символа)

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/products/search?q=толстовка"
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "name": "Чёрная толстовка оверсайз",
    "slug": "black-oversized-hoodie",
    "description": "Премиальная толстовка из плотного хлопка 380 г/м²",
    "price": 6300,
    "discount": 0,
    "images": [...],
    "categories": [...]
  }
]
```

**Ошибки:**
- `400` - Запрос должен содержать минимум 2 символа

---

### 3. Популярные товары

**GET** `/api/products/popular`

**Query параметры:**
- `limit` - Количество товаров (по умолчанию 10)

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/products/popular?limit=10"
```

**Пример ответа:**
```json
[
  {
    "id": 4,
    "name": "Чёрная кепка с вышивкой",
    "slug": "black-cap-embroidery",
    "salesCount": 112,
    "viewCount": 340,
    "price": 1500,
    ...
  }
]
```

---

### 4. Товары в распродаже

**GET** `/api/products/sale`

**Query параметры:**
- `limit` - Количество товаров (по умолчанию 20)

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/products/sale?limit=20"
```

**Пример ответа:**
```json
[
  {
    "id": 2,
    "name": "Белая футболка базовая",
    "slug": "white-basic-tshirt",
    "cardStatus": "SALE",
    "price": 2500,
    "discount": 20,
    ...
  }
]
```

---

### 5. Новинки

**GET** `/api/products/new`

**Query параметры:**
- `limit` - Количество товаров (по умолчанию 20)

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/products/new?limit=20"
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "name": "Чёрная толстовка оверсайз",
    "slug": "black-oversized-hoodie",
    "cardStatus": "NEW",
    ...
  }
]
```

---

### 6. Получить товар по slug

**GET** `/api/products/:slug`

**Пример запроса:**
```bash
curl -X GET https://saliy-shop.ru/api/products/black-oversized-hoodie
```

**Пример ответа:**
```json
{
  "id": 1,
  "name": "Чёрная толстовка оверсайз",
  "slug": "black-oversized-hoodie",
  "description": "Премиальная толстовка из плотного хлопка 380 г/м². Свободный крой, мягкий флис внутри.",
  "cardStatus": "NEW",
  "gender": "unisex",
  "color": "black",
  "weight": 650,
  "price": 6300,
  "discount": 0,
  "images": [
    {
      "url": "products/hoodie-black/front.jpg",
      "isPreview": true,
      "previewOrder": 1
    },
    {
      "url": "products/hoodie-black/back.jpg",
      "isPreview": true,
      "previewOrder": 2
    }
  ],
  "stock": {
    "XS": 5,
    "S": 10,
    "M": 15,
    "L": 10,
    "XL": 5
  },
  "isActive": true,
  "viewCount": 1,
  "salesCount": 0,
  "categories": [
    {
      "category": {
        "id": 1,
        "name": "Толстовки",
        "slug": "hoodies",
        "type": "TOP"
      }
    },
    {
      "category": {
        "id": 5,
        "name": "Новинки",
        "slug": "new",
        "type": "OTHER"
      }
    }
  ],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

**Ошибки:**
- `404` - Товар не найден

**Примечание:** При получении товара счётчик просмотров автоматически увеличивается на 1.

---

### 7. Проверить наличие товара

**GET** `/api/products/:id/stock`

**Query параметры:**
- `size` - Размер (XS/S/M/L/XL/ONE SIZE)

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/products/1/stock?size=M"
```

**Пример ответа:**
```json
{
  "productId": 1,
  "size": "M",
  "inStock": true,
  "quantity": 15
}
```

---

### 8. Получить цену со скидкой

**GET** `/api/products/:id/price`

**Пример запроса:**
```bash
curl -X GET https://saliy-shop.ru/api/products/2/price
```

**Пример ответа:**
```json
{
  "productId": 2,
  "price": 2500,
  "discount": 20,
  "finalPrice": 2000,
  "savings": 500,
  "currency": "RUB"
}
```

---

## Примеры использования

### Получить все товары категории "Толстовки"
```bash
curl -X GET "https://saliy-shop.ru/api/products?categorySlug=hoodies"
```

### Получить товары унисекс в распродаже
```bash
curl -X GET "https://saliy-shop.ru/api/products?gender=unisex&status=SALE"
```

### Получить товары в ценовом диапазоне
```bash
curl -X GET "https://saliy-shop.ru/api/products?minPrice=1000&maxPrice=5000"
```

### Получить только товары в наличии
```bash
curl -X GET "https://saliy-shop.ru/api/products?inStock=true"
```

### Поиск по названию
```bash
curl -X GET "https://saliy-shop.ru/api/products/search?q=толстовка"
```

### Получить топ-10 популярных товаров
```bash
curl -X GET "https://saliy-shop.ru/api/products/popular?limit=10"
```

### Получить детальную информацию о товаре
```bash
curl -X GET https://saliy-shop.ru/api/products/black-oversized-hoodie
```

### Проверить наличие размера M
```bash
curl -X GET "https://saliy-shop.ru/api/products/1/stock?size=M"
```

---

## Расчёт финальной цены

Финальная цена рассчитывается по формуле:
```
finalPrice = price - (price * discount / 100)
```

Пример:
- Цена: 2500 руб
- Скидка: 20%
- Финальная цена: 2500 - (2500 * 20 / 100) = 2000 руб

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные параметры |
| 404 | Товар не найден |
| 500 | Ошибка сервера |
