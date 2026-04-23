# API управления товарами (Admin)

Административный API для управления товарами. Все эндпоинты требуют авторизации через Telegram.

**Базовый URL:** `/api/admin/products`

**Требуется:** `AdminGuard` (JWT токен администратора)

---

## Содержание

- [Типы данных](#типы-данных)
- [Эндпоинты](#эндпоинты)
  - [POST /api/admin/products](#post-apiadminproducts) - Создать товар
  - [GET /api/admin/products](#get-apiadminproducts) - Получить список товаров
  - [GET /api/admin/products/:id](#get-apiadminproductsid) - Получить товар по ID
  - [GET /api/admin/products/enums/all](#get-apiadminproductsenums) - Получить enums
  - [PATCH /api/admin/products/:id](#patch-apiadminproductsid) - Обновить товар
  - [DELETE /api/admin/products/:id](#delete-apiadminproductsid) - Удалить товар
  - [PATCH /api/admin/products/:id/delete-image](#patch-apiadminproductsiddelete-image) - Удалить изображение
  - [POST /api/admin/products/:id/images](#post-apiadminproductsidimages) - Добавить фото
  - [PATCH /api/admin/products/:id/set-previews](#patch-apiadminproductsidset-previews) - Назначить превью (до 2)
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

### GET /api/admin/products

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

### GET /api/admin/products/:id

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
  "isActive": true,
  "categories": [...],
  "viewCount": 245,
  "salesCount": 12,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T12:00:00.000Z"
}
```

---

### GET /api/admin/products/enums/all

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

### PATCH /api/admin/products/:id

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
| `slug` | `string` | Уникальный слаг (URL) |
| `description` | `string` | Описание |
| `cardStatus` | `CardStatus` | Статус карточки |
| `gender` | `GenderType` | Пол |
| `color` | `string` | Цвет |
| `weight` | `number` | Вес в граммах |
| `price` | `number` | Цена в рублях |
| `discount` | `number` | Скидка (0-100) |
| `stock` | `object` | Остатки: `{"S": 10, "M": 5}` |
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

### PATCH /api/admin/products/:id/delete-image

Удалить конкретное изображение товара (из S3 и из `images`).

**Content-Type:** `application/json`

**Тело запроса:**

```json
{
  "imageUrl": "https://storage.yandexcloud.net/saliy-shop/products/21/1714000000000-0.jpg"
}
```

> `imageUrl` может быть полным URL (после `S3UrlInterceptor`) ИЛИ голым S3-ключом (`products/21/foo.jpg`) — бэк нормализует строку перед поиском в массиве.

**Пример ответа:**

```json
{
  "message": "Image deleted successfully",
  "product": {
    "id": 21,
    "images": [
      { "url": "products/21/1714000000001-1.jpg", "isPreview": true, "previewOrder": 1 }
    ]
  }
}
```

**Ошибки:**
- `400 "Image not found in product"` — такого изображения у товара нет
- `404` — товара не существует

---

### POST /api/admin/products/:id/images

Добавить новые фото к существующему товару (без замены остальных).
Новые фото добавляются как **не превью** (`previewOrder = 999`). Установить их превью-статус — через `set-previews`.

**Content-Type:** `multipart/form-data`

**Поля формы:**

| Поле       | Тип    | Обяз. | Описание                                              |
|------------|--------|-------|-------------------------------------------------------|
| `images[]` | file[] | ✅    | До 10 файлов (jpg/png/webp, до 10MB каждое)           |

**Пример (JS):**
```js
const fd = new FormData();
photos.forEach(f => fd.append('images', f));
await fetch('/api/admin/products/21/images', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: fd,
});
```

**Ответ:**
```json
{
  "message": "Добавлено 2 фото",
  "product": { "id": 21, "images": [ ... ] }
}
```

---

### PATCH /api/admin/products/:id/set-previews

Назначить **до 2 превью-фото** товара.

- `primary` — основное фото, показывается в карточке (`previewOrder = 1`) — **обязательно**
- `hover`   — фото при наведении (`previewOrder = 2`) — опционально
- Остальные фото товара автоматически теряют статус превью (`previewOrder = 999`)

**Content-Type:** `application/json`

**Тело запроса:**
```json
{
  "primary": "products/21/1714000000000-0.jpg",
  "hover":   "products/21/1714000000001-1.jpg"
}
```

> Значения принимают полный URL ИЛИ S3-ключ. Чтобы оставить только одно превью — передай `primary` без `hover` (либо `hover: null`).

**Ответ:**
```json
{
  "message": "Превью обновлены",
  "product": { "id": 21, "images": [ ... ] }
}
```

**Ошибки:**
- `400 "primary is required"` — не передан основной превью
- `400 "primary и hover не могут быть одним и тем же изображением"`
- `400 "primary изображение не найдено у товара"` (или `hover`)
- `404` — товара не существует

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

4. **Размерная таблица:**
   - Размерная сетка больше не хранится отдельным полем
   - Загружайте фото таблицы как обычное изображение товара через `images[]`

5. **Авторизация:**
   - Все эндпоинты требуют AdminGuard
   - Токен передается в заголовке `Authorization: Bearer <token>`

---

## POST /api/admin/products

Создать новый товар. Поддерживает `multipart/form-data` для загрузки изображений.

**Первое загруженное изображение автоматически становится превью** (`isPreview: true, previewOrder: 1`).

### Request (multipart/form-data):

| Поле | Тип | Обяз. | Описание |
|------|-----|-------|----------|
| `name` | string | ✅ | Название товара |
| `slug` | string | ✅ | Уникальный слаг (URL) |
| `description` | string | ❌ | Описание |
| `price` | number | ✅ | Цена в рублях |
| `discount` | number | ❌ | Скидка 0-100 |
| `cardStatus` | enum | ❌ | NONE / NEW / SALE / SOLD_OUT / PRE_ORDER / COMING_SOON |
| `gender` | enum | ❌ | male / female / unisex |
| `color` | string | ❌ | Цвет |
| `weight` | number | ❌ | Вес в граммах |
| `stock` | JSON | ❌ | `{"S": 10, "M": 5, "L": 0}` |
| `isActive` | boolean | ❌ | По умолчанию `true` |
| `categoryIds` | number[] | ❌ | ID категорий для привязки |
| `images[]` | file[] | ❌ | До 10 изображений (jpg/png/webp, до 10MB каждое) |

### Пример (curl):
```bash
curl -X POST https://saliy-shop.ru/api/admin/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=Джинсовка SALIY чёрная" \
  -F "slug=dzhinsovka-saliy-black" \
  -F "price=9500" \
  -F "gender=unisex" \
  -F "color=black" \
  -F 'stock={"S":10,"M":5,"L":3}' \
  -F "categoryIds=1" \
  -F "categoryIds=3" \
  -F "images=@./photo1.jpg" \
  -F "images=@./photo2.jpg"
```

### Response `200 OK`:
Возвращает созданный товар с связями категорий.

### Ошибки:
- `400` — slug уже используется
- `400` — неверный формат файла (только jpg/png/webp)

---

## DELETE /api/admin/products/:id

Удалить товар.

### Логика удаления:
- **Если у товара НЕТ связанных заказов** — товар физически удаляется из БД, файлы изображений удаляются с диска. Каскадно удаляются: связи с категориями, записи в корзинах пользователей.
- **Если у товара ЕСТЬ связанные заказы** — товар **деактивируется** (`isActive = false`), чтобы не нарушить историю заказов.

### Response (физическое удаление):
```json
{
  "success": true,
  "deleted": true,
  "message": "Товар удалён"
}
```

### Response (деактивация):
```json
{
  "success": true,
  "deleted": false,
  "message": "Товар деактивирован, так как есть связанные заказы (5)",
  "product": { "id": 20, "isActive": false, "...": "..." }
}
```

### Ошибки:
- `404` — товар не найден
- `400` — неверный ID

---

## GET /api/admin/products/low-stock

Товары с низким остатком на складе. Полезно для отслеживания, что нужно заказать/дозакупить.

### Query параметры:
- `threshold` — порог (default: 5). Возвращаются размеры где остаток ≤ threshold.

### Response:
```json
{
  "threshold": 5,
  "count": 3,
  "products": [
    {
      "id": 20,
      "name": "Джинсовка SALIY чёрная",
      "slug": "dzhinsovka-saliy-black",
      "price": 9500,
      "discount": 10,
      "imageUrl": { "url": "...", "isPreview": true },
      "lowSizes": [
        { "size": "S", "quantity": 2 },
        { "size": "L", "quantity": 0 }
      ],
      "totalStock": 7
    }
  ]
}
```

### Поля:
- **lowSizes** — только те размеры, где остаток ≤ threshold
- **totalStock** — суммарный остаток по всем размерам
