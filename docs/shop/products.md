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
  sizeChart?: Object;      // Размерная таблица (опционально)

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

### Формат sizeChart (размерная таблица)

**Вариант 1: Просто URL картинки** (рекомендуется)
```json
"sizeChart/photo_2026-03-30_00-20-26.jpg"
```

**Вариант 2: Структурированные данные**
```json
{
  "XS": {
    "chest": 88,      // Обхват груди (см)
    "waist": 70,      // Обхват талии (см)
    "hips": 90,       // Обхват бёдер (см)
    "length": 65      // Длина изделия (см)
  },
  "S": {
    "chest": 92,
    "waist": 74,
    "hips": 94,
    "length": 67
  },
  "M": {
    "chest": 96,
    "waist": 78,
    "hips": 98,
    "length": 69
  }
}
```

**Примечание:** Формат гибкий - можно хранить как готовую картинку с размерной сеткой (строка с URL), так и структурированные данные (объект с размерами).

---

## Эндпоинты

### 1. Получить список товаров

**GET** `/api/products`

**Query параметры:**
- `limit` - Количество товаров (по умолчанию 20)
- `offset` - Смещение для пагинации

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/products"
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
      "sizeChart": "sizeChart/hoodie-size-chart.jpg",
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
  "sizeChart": "sizeChart/hoodie-size-chart.jpg",
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

### Получить все товары
```bash
curl -X GET "https://saliy-shop.ru/api/products"
```

### Поиск по названию
```bash
curl -X GET "https://saliy-shop.ru/api/products/search?q=толстовка"
```

### Получить популярные товары
```bash
curl -X GET "https://saliy-shop.ru/api/products/popular"
```

### Получить товары в распродаже
```bash
curl -X GET "https://saliy-shop.ru/api/products/sale"
```

### Получить новинки
```bash
curl -X GET "https://saliy-shop.ru/api/products/new"
```

### Получить детальную информацию о товаре
```bash
curl -X GET https://saliy-shop.ru/api/products/black-oversized-hoodie
```

### Проверить наличие размера M
```bash
curl -X GET "https://saliy-shop.ru/api/products/13/stock?size=M"
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

## Безопасность и ограничения

### Защита админских операций

Операции создания, обновления и удаления товаров защищены `AdminGuard`:

- `POST /api/products` - создание товара
- `PUT /api/products/:id` - обновление товара
- `DELETE /api/products/:id` - удаление товара

**Требуется авторизация администратора:**
```http
Authorization: Bearer <admin_token>
```

Admin токен получается через Telegram (см. [Admin/auth.md](../Admin/auth.md)).

### Rate Limiting

API защищён от DDoS и скрейпинга:

| Эндпоинт | Лимит |
|----------|-------|
| Все эндпоинты | 100 запросов/минуту на IP |
| `/api/products/search` | 20 запросов/минуту на IP |

При превышении лимита вернётся ошибка `429 Too Many Requests`.

### Логирование

Все изменения товаров логируются для аудита:

- Создание товара: `ID, slug, name, price`
- Обновление: список изменённых полей (name, price, discount, isActive)
- Удаление: `ID, slug, name`

Логи доступны администраторам для отслеживания подозрительной активности.

### Валидация данных

Все входные данные проходят валидацию через `class-validator`:

- `price` - положительное число
- `discount` - целое число 0-100
- `slug` - уникальность проверяется при создании/обновлении
- Параметризованные запросы через Prisma (защита от SQL injection)

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные параметры |
| 401 | Требуется авторизация администратора |
| 404 | Товар не найден |
| 429 | Превышен лимит запросов |
| 500 | Ошибка сервера |
