# API управления товарами (Admin)

Административный API для управления товарами. Все эндпоинты требуют авторизации через Telegram.

**Базовый URL:** `/api/admin/products`

**Требуется:** `AdminGuard` (JWT токен администратора)

---

## Содержание

- [Типы данных](#типы-данных)
- [Эндпоинты](#эндпоинты)
  - [GET /admin/products](#get-adminproducts) - Получить список товаров
  - [GET /admin/products/:id](#get-adminproductsid) - Получить товар по ID
  - [GET /admin/products/enums/all](#get-adminproductsenums) - Получить enums
  - [PATCH /admin/products/:id](#patch-adminproductsid) - Обновить товар
  - [PATCH /admin/products/:id/delete-image](#patch-adminproductsiddelete-image) - Удалить изображение
- [Примеры](#примеры)

---

## Типы данных

### CardStatus (Статус карточки товара)

| Значение | Описание |
|----------|----------|
| `NONE` | Без метки |
| `NEW` | Новинка |
| `SALE` | Распродажа |
| `SOLD_OUT` | Распродано |
| `PRE_ORDER` | Предзаказ |
| `COMING_SOON` | Скоро в продаже |

### GenderType (Пол)

| Значение | Описание |
|----------|----------|
| `male` | Мужской |
| `female` | Женский |
| `unisex` | Унисекс |

### CategoryType (Тип категории)

| Значение | Описание |
|----------|----------|
| `TOP` | Верхняя одежда |
| `BOTTOM` | Нижняя одежда |
| `ACCESSORIES` | Аксессуары |
| `SPORT` | Спортивная одежда |
| `OTHER` | Другое |

### Объект Product

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `number` | ID товара |
| `name` | `string` | Название товара |
| `slug` | `string` | URL-friendly идентификатор |
| `description` | `string` | Описание товара |
| `cardStatus` | `CardStatus` | Статус карточки |
| `gender` | `GenderType` | Для какого пола |
| `color` | `string` | Цвет товара |
| `weight` | `number` | Вес в граммах |
| `price` | `number` | Цена в рублях |
| `discount` | `number` | Скидка в процентах (0-100) |
| `images` | `Array<ImageObject>` | Массив изображений |
| `stock` | `object` | Остатки по размерам: `{"S": 10, "M": 5}` |
| `sizeChart` | `object` | Размерная таблица |
| `isActive` | `boolean` | Активен ли товар |
| `viewCount` | `number` | Количество просмотров |
| `salesCount` | `number` | Количество продаж |
| `categories` | `Array<Category>` | Массив категорий |
| `createdAt` | `string` | Дата создания |
| `updatedAt` | `string` | Дата обновления |

### Объект ImageObject

```json
{
  "url": "/uploads/products/product-1-1234567890.jpg",
  "isPreview": false,
  "previewOrder": 1
}
```

---

## Эндпоинты

### GET /admin/products

Получить список всех товаров с фильтрацией и пагинацией.

**Query параметры:**

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | `number` | `1` | Номер страницы |
| `limit` | `number` | `20` | Товаров на странице |
| `search` | `string` | - | Поиск по названию, описанию, slug |
| `category` | `string` | - | Фильтр по slug категории |
| `gender` | `string` | - | Фильтр по полу (`male`, `female`, `unisex`) |
| `cardStatus` | `string` | - | Фильтр по статусу |
| `isActive` | `boolean` | - | Фильтр по активности |

**Пример запроса:**

```http
GET /api/admin/products?page=1&limit=20&gender=male&isActive=true
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
{
  "products": [
    {
      "id": 1,
      "name": "Куртка зимняя",
      "slug": "winter-jacket",
      "description": "Теплая куртка...",
      "cardStatus": "NEW",
      "gender": "male",
      "color": "black",
      "weight": 1200,
      "price": 15000,
      "discount": 10,
      "images": [
        {
          "url": "/uploads/products/product-1-123456.jpg",
          "isPreview": true,
          "previewOrder": 1
        }
      ],
      "stock": {"S": 5, "M": 10, "L": 3},
      "isActive": true,
      "viewCount": 245,
      "salesCount": 12,
      "categories": [
        {
          "id": 1,
          "name": "Куртки",
          "slug": "jackets",
          "type": "TOP"
        }
      ],
      "createdAt": "2026-03-30T10:00:00.000Z",
      "updatedAt": "2026-03-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### GET /admin/products/:id

Получить подробную информацию о товаре.

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `number` | ID товара |

**Пример запроса:**

```http
GET /api/admin/products/1
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
{
  "id": 1,
  "name": "Куртка зимняя",
  "slug": "winter-jacket",
  "description": "Подробное описание...",
  "cardStatus": "NEW",
  "gender": "male",
  "color": "black",
  "weight": 1200,
  "price": 15000,
  "discount": 10,
  "images": [...],
  "stock": {"S": 5, "M": 10, "L": 3},
  "sizeChart": {
    "S": {"chest": 90, "waist": 75},
    "M": {"chest": 95, "waist": 80}
  },
  "isActive": true,
  "categories": [...],
  "viewCount": 245,
  "salesCount": 12,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T12:00:00.000Z"
}
```

---

### GET /admin/products/enums/all

Получить все enums для товаров (категории, полы, статусы).

**Пример запроса:**

```http
GET /api/admin/products/enums/all
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
{
  "genders": ["male", "female", "unisex"],
  "cardStatuses": ["NONE", "NEW", "SALE", "SOLD_OUT", "PRE_ORDER", "COMING_SOON"],
  "categoryTypes": ["TOP", "BOTTOM", "ACCESSORIES", "SPORT", "OTHER"],
  "categories": [
    {
      "id": 1,
      "name": "Куртки",
      "slug": "jackets",
      "type": "TOP"
    },
    {
      "id": 2,
      "name": "Брюки",
      "slug": "pants",
      "type": "BOTTOM"
    }
  ]
}
```

---

### PATCH /admin/products/:id

Обновить товар (с загрузкой новых фотографий).

**Content-Type:** `multipart/form-data`

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `number` | ID товара |

**Поля (все опциональные):**

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | `string` | Название |
| `description` | `string` | Описание |
| `cardStatus` | `CardStatus` | Статус карточки |
| `gender` | `GenderType` | Пол |
| `color` | `string` | Цвет |
| `weight` | `number` | Вес в граммах |
| `price` | `number` | Цена в рублях |
| `discount` | `number` | Скидка (0-100) |
| `stock` | `object` | Остатки: `{"S": 10, "M": 5}` |
| `sizeChart` | `object` | Размерная таблица |
| `isActive` | `boolean` | Активность |
| `categoryIds` | `Array<number>` | ID категорий |
| `images[]` | `File[]` | Новые фотографии (до 10 файлов) |

**Пример запроса (FormData):**

```javascript
const formData = new FormData();
formData.append('name', 'Куртка зимняя (обновленная)');
formData.append('price', '14000');
formData.append('discount', '15');
formData.append('stock', JSON.stringify({"S": 10, "M": 15, "L": 5}));
formData.append('categoryIds', JSON.stringify([1, 3]));
formData.append('images', file1);
formData.append('images', file2);

fetch('/api/admin/products/1', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer <admin_token>'
  },
  body: formData
});
```

**Пример ответа:**

```json
{
  "id": 1,
  "name": "Куртка зимняя (обновленная)",
  "price": 14000,
  "discount": 15,
  "stock": {"S": 10, "M": 15, "L": 5},
  "images": [
    {"url": "/uploads/products/product-1-old.jpg", "isPreview": true},
    {"url": "/uploads/products/product-1-1234567890-new1.jpg", "isPreview": false},
    {"url": "/uploads/products/product-1-1234567891-new2.jpg", "isPreview": false}
  ],
  "categories": [
    {"id": 1, "name": "Куртки", "slug": "jackets"},
    {"id": 3, "name": "Спортивная одежда", "slug": "sport"}
  ],
  "updatedAt": "2026-03-30T14:30:00.000Z"
}
```

---

### PATCH /admin/products/:id/delete-image

Удалить конкретное изображение товара.

**Content-Type:** `application/json`

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `number` | ID товара |

**Тело запроса:**

```json
{
  "imageUrl": "/uploads/products/product-1-1234567890.jpg"
}
```

**Пример ответа:**

```json
{
  "message": "Image deleted successfully",
  "product": {
    "id": 1,
    "images": [
      {"url": "/uploads/products/product-1-old.jpg", "isPreview": true}
    ]
  }
}
```

---

## Примеры

### Пример 1: Обновление цены и скидки

```http
PATCH /api/admin/products/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "price": 12000,
  "discount": 20
}
```

### Пример 2: Изменение остатков по размерам

```http
PATCH /api/admin/products/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "stock": {
    "XS": 5,
    "S": 15,
    "M": 20,
    "L": 10,
    "XL": 5
  }
}
```

### Пример 3: Добавление товара в категории

```http
PATCH /api/admin/products/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "categoryIds": [1, 2, 5]
}
```

### Пример 4: Загрузка новых фотографий

```javascript
// С использованием fetch
const formData = new FormData();
formData.append('images', imageFile1);
formData.append('images', imageFile2);
formData.append('images', imageFile3);

await fetch('/api/admin/products/1', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
});
```

### Пример 5: Деактивация товара

```http
PATCH /api/admin/products/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Bad Request - некорректные данные |
| 401 | Unauthorized - отсутствует токен |
| 403 | Forbidden - недостаточно прав |
| 404 | Not Found - товар не найден |
| 413 | Payload Too Large - файл слишком большой (лимит 10MB) |
| 500 | Internal Server Error - ошибка сервера |

---

## Примечания

1. **Загрузка изображений:**
   - Максимум 10 файлов за раз
   - Максимальный размер файла: 10MB
   - Поддерживаемые форматы: JPG, JPEG, PNG, WEBP
   - Файлы сохраняются в `/uploads/products/`

2. **Обновление категорий:**
   - При передаче `categoryIds` старые связи удаляются
   - Создаются новые связи с указанными категориями

3. **Остатки товара (stock):**
   - Формат: `{"размер": количество}`
   - Пример: `{"S": 10, "M": 5, "L": 0}`

4. **Размерная таблица (sizeChart):**
   - Произвольная структура JSON
   - Пример: `{"S": {"chest": 90, "waist": 75}}`

5. **Авторизация:**
   - Все эндпоинты требуют AdminGuard
   - Токен передается в заголовке `Authorization: Bearer <token>`
