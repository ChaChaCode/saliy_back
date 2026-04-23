# API управления категориями (Admin)

Административный API для управления категориями товаров. Все эндпоинты требуют авторизации через Telegram.

**Базовый URL:** `/api/admin/categories`

**Требуется:** `AdminGuard` (JWT токен администратора)

---

## Содержание

- [Типы данных](#типы-данных)
- [Баннеры категории](#баннеры-категории) — как загружать/заменять/удалять фото
- [Эндпоинты](#эндпоинты)
  - [GET /api/admin/categories](#get-apiadmincategories) - Получить список категорий
  - [GET /api/admin/categories/:id](#get-apiadmincategoriesid) - Получить категорию по ID
  - [POST /api/admin/categories](#post-apiadmincategories) - Создать категорию (+ загрузка баннеров)
  - [PATCH /api/admin/categories/:id](#patch-apiadmincategoriesid) - Обновить категорию (+ замена баннеров)
  - [DELETE /api/admin/categories/:id](#delete-apiadmincategoriesid) - Удалить категорию (баннеры из S3 тоже)
  - [DELETE /api/admin/categories/:id/banner/:type](#delete-apiadmincategoriesidbannertype) - Удалить один баннер (desktop/mobile)
- [Примеры](#примеры)

---

## Типы данных

### CategoryType (Тип категории)

| Значение | Описание |
|----------|----------|
| `TOP` | Верхняя одежда |
| `BOTTOM` | Нижняя одежда |
| `ACCESSORIES` | Аксессуары |
| `SPORT` | Спортивная одежда |
| `OTHER` | Другое |

### Объект Category

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `number` | ID категории |
| `name` | `string` | Название категории |
| `slug` | `string` | URL-friendly идентификатор (уникальный) |
| `type` | `CategoryType` | Тип категории |
| `description` | `string \| null` | Описание категории |
| `desktopBannerUrl` | `string \| null` | URL баннера для десктопа |
| `mobileBannerUrl` | `string \| null` | URL баннера для мобильных |
| `isActive` | `boolean` | Активна ли категория |
| `productsCount` | `number` | Количество товаров в категории |
| `createdAt` | `string` | Дата создания |
| `updatedAt` | `string` | Дата обновления |

---

## Баннеры категории

У каждой категории есть **два** баннера: `desktopBanner` и `mobileBanner`. Оба опциональны, оба хранятся в S3 (Yandex Object Storage).

### Где они устанавливаются/меняются

- **Создание:** `POST /api/admin/categories` — передать файлы `desktopBanner` / `mobileBanner` в `multipart/form-data`.
- **Замена:** `PATCH /api/admin/categories/:id` — передать новые файлы с теми же именами полей. Старые удалятся из S3 автоматически.
- **Удаление по одному:** `DELETE /api/admin/categories/:id/banner/:type` (где `type` = `desktop` или `mobile`) — файл удаляется из S3, соответствующее поле в БД становится `null`.
- **Удаление вместе с категорией:** `DELETE /api/admin/categories/:id` — оба баннера чистятся из S3.

### Формат URL баннеров

- В БД хранится S3-ключ, например: `categories/desktop-cat5-1714000000000.jpg`
- В ответе API (после `S3UrlInterceptor`) клиент видит полный URL: `https://storage.yandexcloud.net/saliy-shop/categories/desktop-cat5-1714000000000.jpg`

### Ограничения на файл

| Параметр | Значение |
|---|---|
| Форматы | `jpg`, `jpeg`, `png`, `webp` |
| Макс. размер | 5 MB на файл |
| Макс. количество | 1 `desktopBanner` + 1 `mobileBanner` за запрос |

---

## Эндпоинты

### GET /api/admin/categories

Получить список всех категорий с количеством товаров.

**Пример запроса:**

```http
GET /api/admin/categories
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
[
  {
    "id": 1,
    "name": "Куртки",
    "slug": "jackets",
    "type": "TOP",
    "description": "Верхняя одежда для холодной погоды",
    "desktopBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/desktop-cat1-1234567890.jpg",
    "mobileBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/mobile-cat1-1234567890.jpg",
    "isActive": true,
    "productsCount": 15,
    "createdAt": "2026-03-30T10:00:00.000Z",
    "updatedAt": "2026-03-30T12:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Брюки",
    "slug": "pants",
    "type": "BOTTOM",
    "description": "Брюки и джинсы",
    "desktopBannerUrl": null,
    "mobileBannerUrl": null,
    "isActive": true,
    "productsCount": 8,
    "createdAt": "2026-03-30T11:00:00.000Z",
    "updatedAt": "2026-03-30T11:00:00.000Z"
  }
]
```

---

### GET /api/admin/categories/:id

Получить подробную информацию о категории.

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `number` | ID категории |

**Пример запроса:**

```http
GET /api/admin/categories/1
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
{
  "id": 1,
  "name": "Куртки",
  "slug": "jackets",
  "type": "TOP",
  "description": "Верхняя одежда для холодной погоды",
  "desktopBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/desktop-cat1-1234567890.jpg",
  "mobileBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/mobile-cat1-1234567890.jpg",
  "isActive": true,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T12:00:00.000Z",
  "_count": {
    "products": 15
  }
}
```

---

### POST /api/admin/categories

Создать новую категорию с загрузкой баннеров.

**Content-Type:** `multipart/form-data`

**Обязательные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | `string` | Название категории |
| `slug` | `string` | URL-friendly идентификатор (уникальный) |

**Опциональные поля:**

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `type` | `CategoryType` | `OTHER` | Тип категории |
| `description` | `string` | - | Описание |
| `isActive` | `boolean` | `true` | Активность |
| `desktopBanner` | `File` | - | Баннер для десктопа (JPG, PNG, WEBP, макс. 5MB) |
| `mobileBanner` | `File` | - | Баннер для мобильных (JPG, PNG, WEBP, макс. 5MB) |

**Пример запроса (FormData):**

```javascript
const formData = new FormData();
formData.append('name', 'Куртки');
formData.append('slug', 'jackets');
formData.append('type', 'TOP');
formData.append('description', 'Верхняя одежда для холодной погоды');
formData.append('isActive', 'true');
formData.append('desktopBanner', desktopBannerFile);
formData.append('mobileBanner', mobileBannerFile);

fetch('/api/admin/categories', {
  method: 'POST',
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
  "name": "Куртки",
  "slug": "jackets",
  "type": "TOP",
  "description": "Верхняя одежда для холодной погоды",
  "desktopBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/desktop-cat1-1711800000000.jpg",
  "mobileBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/mobile-cat1-1711800000000.jpg",
  "isActive": true,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T10:00:00.000Z"
}
```

---

### PATCH /api/admin/categories/:id

Обновить категорию (с возможностью загрузки новых баннеров).

**Content-Type:** `multipart/form-data`

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `number` | ID категории |

**Поля (все опциональные):**

| Поле | Тип | Описание |
|------|-----|----------|
| `name` | `string` | Название |
| `slug` | `string` | URL-friendly идентификатор |
| `type` | `CategoryType` | Тип категории |
| `description` | `string` | Описание |
| `isActive` | `boolean` | Активность |
| `desktopBanner` | `File` | Новый баннер для десктопа (замена) |
| `mobileBanner` | `File` | Новый баннер для мобильных (замена) |

**Пример запроса (FormData):**

```javascript
const formData = new FormData();
formData.append('name', 'Зимние куртки');
formData.append('description', 'Обновленное описание');
formData.append('desktopBanner', newDesktopBannerFile);

fetch('/api/admin/categories/1', {
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
  "name": "Зимние куртки",
  "slug": "jackets",
  "type": "TOP",
  "description": "Обновленное описание",
  "desktopBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/desktop-cat1-1711805000000.jpg",
  "mobileBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/mobile-cat1-1711800000000.jpg",
  "isActive": true,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T14:30:00.000Z"
}
```

---

### DELETE /api/admin/categories/:id

Удалить категорию (только если нет связанных товаров).

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `number` | ID категории |

**Пример запроса:**

```http
DELETE /api/admin/categories/1
Authorization: Bearer <admin_token>
```

**Пример успешного ответа:**

```json
{
  "message": "Category \"Куртки\" deleted successfully"
}
```

**Ошибка при наличии товаров:**

```json
{
  "statusCode": 400,
  "message": "Cannot delete category with 15 associated products",
  "error": "Bad Request"
}
```

---

### DELETE /api/admin/categories/:id/banner/:type

Удалить один баннер категории (desktop или mobile), не трогая саму категорию и второй баннер. Файл удаляется из S3, соответствующее поле в БД выставляется в `null`.

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `number` | ID категории |
| `type` | `"desktop" \| "mobile"` | Какой баннер удалить |

**Пример запроса:**

```http
DELETE /api/admin/categories/5/banner/desktop
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
{
  "message": "desktopBanner удалён",
  "category": {
    "id": 5,
    "name": "Джинсовки",
    "desktopBannerUrl": null,
    "mobileBannerUrl": "https://storage.yandexcloud.net/saliy-shop/categories/mobile-cat5-1714000000.jpg",
    "...": "..."
  }
}
```

**Если баннера уже нет:** возвращает `200 OK` с сообщением `"desktopBanner уже отсутствует"` (идемпотентно).

**Ошибки:**
- `400 "type must be \"desktop\" or \"mobile\""`
- `404` — категория не найдена

---

## Примеры

### Пример 1: Создание категории без баннеров

```http
POST /api/admin/categories
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Аксессуары",
  "slug": "accessories",
  "type": "ACCESSORIES",
  "description": "Шапки, шарфы, перчатки"
}
```

### Пример 2: Обновление только названия и описания

```http
PATCH /api/admin/categories/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Зимние куртки",
  "description": "Теплые куртки для суровой зимы"
}
```

### Пример 3: Загрузка только desktop баннера

```javascript
const formData = new FormData();
formData.append('desktopBanner', desktopBannerFile);

await fetch('/api/admin/categories/1', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
});
```

### Пример 4: Деактивация категории

```http
PATCH /api/admin/categories/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

### Пример 5: Изменение типа категории

```http
PATCH /api/admin/categories/5
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "type": "SPORT"
}
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Bad Request - некорректные данные или slug уже существует |
| 401 | Unauthorized - отсутствует токен |
| 403 | Forbidden - недостаточно прав |
| 404 | Not Found - категория не найдена |
| 413 | Payload Too Large - файл слишком большой (лимит 5MB) |
| 500 | Internal Server Error - ошибка сервера |

---

## Примечания

1. **Уникальность slug:**
   - Поле `slug` должно быть уникальным
   - При попытке создать/обновить категорию с существующим slug вернется ошибка 400

2. **Загрузка баннеров:**
   - Максимальный размер файла: 5MB
   - Поддерживаемые форматы: JPG, JPEG, PNG, WEBP
   - Файлы загружаются в Yandex Object Storage (бакет `saliy-shop`, префикс `categories/`)
   - При обновлении старый файл в S3 удаляется автоматически

3. **Удаление категории:**
   - Нельзя удалить категорию, у которой есть связанные товары
   - При удалении баннеры тоже удаляются из S3

4. **Автоматические значения:**
   - `type` по умолчанию: `OTHER`
   - `isActive` по умолчанию: `true`

5. **Авторизация:**
   - Все эндпоинты требуют AdminGuard
   - Токен передается в заголовке `Authorization: Bearer <token>`

6. **Формат имен файлов:**
   - Desktop баннер: `desktop-cat{id}-{timestamp}.{ext}`
   - Mobile баннер: `mobile-cat{id}-{timestamp}.{ext}`
