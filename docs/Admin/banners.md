# API управления баннерами (Admin)

Административный API для управления баннерами главной страницы. Все эндпоинты требуют авторизации через Telegram.

**Базовый URL:** `/api/admin/banners`

**Требуется:** `AdminGuard` (JWT токен администратора)

---

## Содержание

- [Типы данных](#типы-данных)
- [Эндпоинты](#эндпоинты)
  - [GET /api/admin/banners](#get-apiadminbanners) - Получить список баннеров
  - [GET /api/admin/banners/:id](#get-apiadminbannersid) - Получить баннер по ID
  - [POST /api/admin/banners](#post-apiadminbanners) - Создать баннер
  - [PATCH /api/admin/banners/:id](#patch-apiadminbannersid) - Обновить баннер
  - [DELETE /api/admin/banners/:id](#delete-apiadminbannersid) - Удалить баннер
- [Примеры](#примеры)

---

## Типы данных

### Объект Banner

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | `string` | UUID баннера |
| `title` | `string` | Название баннера (для админки) |
| `description` | `string \| null` | Описание |
| `desktopImageUrl` | `string` | URL изображения для десктопа |
| `mobileImageUrl` | `string` | URL изображения для мобильной версии |
| `link` | `string \| null` | Ссылка при клике |
| `order` | `number` | Порядок отображения (0 = первый) |
| `isActive` | `boolean` | Активен ли баннер |
| `createdAt` | `string` | Дата создания |
| `updatedAt` | `string` | Дата обновления |

---

## Эндпоинты

### GET /api/admin/banners

Получить список всех баннеров (включая неактивные), отсортированных по порядку отображения.

**Пример запроса:**

```http
GET /api/admin/banners
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Новая коллекция",
    "description": "Зимняя коллекция 2026",
    "desktopImageUrl": "/uploads/banners/desktop-banner-550e8400-1234567890.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-banner-550e8400-1234567890.jpg",
    "link": "/catalog/new",
    "order": 0,
    "isActive": true,
    "createdAt": "2026-03-30T10:00:00.000Z",
    "updatedAt": "2026-03-30T10:00:00.000Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Скидка 30%",
    "description": null,
    "desktopImageUrl": "/uploads/banners/desktop-banner-660e8400-9876543210.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-banner-660e8400-9876543210.jpg",
    "link": "/sale",
    "order": 1,
    "isActive": false,
    "createdAt": "2026-03-30T11:00:00.000Z",
    "updatedAt": "2026-03-30T12:00:00.000Z"
  }
]
```

---

### GET /api/admin/banners/:id

Получить подробную информацию о баннере.

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `string` | UUID баннера |

**Пример запроса:**

```http
GET /api/admin/banners/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
```

**Пример ответа:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Новая коллекция",
  "description": "Зимняя коллекция 2026",
  "desktopImageUrl": "/uploads/banners/desktop-banner-550e8400-1234567890.jpg",
  "mobileImageUrl": "/uploads/banners/mobile-banner-550e8400-1234567890.jpg",
  "link": "/catalog/new",
  "order": 0,
  "isActive": true,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T10:00:00.000Z"
}
```

---

### POST /api/admin/banners

Создать новый баннер главной страницы.

**Content-Type:** `multipart/form-data`

**Обязательные поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | `string` | Название баннера |
| `desktopImage` | `File` | Изображение для десктопа (JPG, PNG, WEBP, макс. 10MB) |
| `mobileImage` | `File` | Изображение для мобильных (JPG, PNG, WEBP, макс. 10MB) |

**Опциональные поля:**

| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `description` | `string` | - | Описание |
| `link` | `string` | - | Ссылка при клике |
| `order` | `number` | `0` | Порядок отображения |
| `isActive` | `boolean` | `true` | Активность |

**Пример запроса (FormData):**

```javascript
const formData = new FormData();
formData.append('title', 'Новая коллекция');
formData.append('description', 'Зимняя коллекция 2026');
formData.append('link', '/catalog/new');
formData.append('order', '0');
formData.append('isActive', 'true');
formData.append('desktopImage', desktopImageFile);
formData.append('mobileImage', mobileImageFile);

fetch('/api/admin/banners', {
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
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Новая коллекция",
  "description": "Зимняя коллекция 2026",
  "desktopImageUrl": "/uploads/banners/desktop-banner-550e8400-1711800000000.jpg",
  "mobileImageUrl": "/uploads/banners/mobile-banner-550e8400-1711800000000.jpg",
  "link": "/catalog/new",
  "order": 0,
  "isActive": true,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T10:00:00.000Z"
}
```

---

### PATCH /api/admin/banners/:id

Обновить баннер (с возможностью загрузки новых изображений).

**Content-Type:** `multipart/form-data`

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `string` | UUID баннера |

**Поля (все опциональные):**

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | `string` | Название |
| `description` | `string` | Описание |
| `link` | `string` | Ссылка |
| `order` | `number` | Порядок отображения |
| `isActive` | `boolean` | Активность |
| `desktopImage` | `File` | Новое изображение для десктопа (замена) |
| `mobileImage` | `File` | Новое изображение для мобильных (замена) |

**Пример запроса (FormData):**

```javascript
const formData = new FormData();
formData.append('title', 'Обновленное название');
formData.append('isActive', 'false');
formData.append('desktopImage', newDesktopImageFile);

fetch('/api/admin/banners/550e8400-e29b-41d4-a716-446655440000', {
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
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Обновленное название",
  "description": "Зимняя коллекция 2026",
  "desktopImageUrl": "/uploads/banners/desktop-banner-550e8400-1711805000000.jpg",
  "mobileImageUrl": "/uploads/banners/mobile-banner-550e8400-1711800000000.jpg",
  "link": "/catalog/new",
  "order": 0,
  "isActive": false,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T14:30:00.000Z"
}
```

---

### DELETE /api/admin/banners/:id

Удалить баннер (автоматически удаляются файлы изображений).

**Параметры пути:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | `string` | UUID баннера |

**Пример запроса:**

```http
DELETE /api/admin/banners/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
```

**Пример успешного ответа:**

```json
{
  "message": "Banner \"Новая коллекция\" deleted successfully"
}
```

---

## Примеры

### Пример 1: Создание баннера для новой коллекции

```bash
curl -X POST https://saliy-shop.ru/api/admin/banners \
  -H "Authorization: Bearer <admin_token>" \
  -F "title=Новая зимняя коллекция" \
  -F "description=Утепленная одежда для холодов" \
  -F "link=/catalog/winter-2026" \
  -F "order=0" \
  -F "desktopImage=@winter-desktop.jpg" \
  -F "mobileImage=@winter-mobile.jpg"
```

### Пример 2: Создание баннера распродажи

```bash
curl -X POST https://saliy-shop.ru/api/admin/banners \
  -H "Authorization: Bearer <admin_token>" \
  -F "title=Скидка 50%" \
  -F "link=/sale" \
  -F "order=1" \
  -F "desktopImage=@sale-desktop.jpg" \
  -F "mobileImage=@sale-mobile.jpg"
```

### Пример 3: Обновление только текстовых полей

```http
PATCH /api/admin/banners/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "Новое название",
  "description": "Обновленное описание",
  "link": "/new-link"
}
```

### Пример 4: Обновление только desktop изображения

```javascript
const formData = new FormData();
formData.append('desktopImage', newDesktopImageFile);

await fetch('/api/admin/banners/550e8400-e29b-41d4-a716-446655440000', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  },
  body: formData
});
```

### Пример 5: Деактивация баннера

```http
PATCH /api/admin/banners/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "isActive": false
}
```

### Пример 6: Изменение порядка отображения

```http
PATCH /api/admin/banners/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "order": 5
}
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Bad Request - некорректные данные или отсутствуют обязательные поля/файлы |
| 401 | Unauthorized - отсутствует токен |
| 403 | Forbidden - недостаточно прав |
| 404 | Not Found - баннер не найден |
| 413 | Payload Too Large - файл слишком большой (лимит 10MB) |
| 500 | Internal Server Error - ошибка сервера |

---

## Примечания

1. **Обязательные изображения при создании:**
   - При создании баннера обязательно нужны оба изображения (desktop и mobile)
   - При обновлении можно заменить только одно изображение

2. **Загрузка изображений:**
   - Максимальный размер файла: 10MB
   - Поддерживаемые форматы: JPG, JPEG, PNG, WEBP
   - Файлы сохраняются в `/uploads/banners/`
   - При обновлении старые файлы автоматически удаляются

3. **Удаление баннера:**
   - При удалении автоматически удаляются файлы изображений с диска
   - Операция необратима

4. **Порядок отображения:**
   - Баннеры сортируются по полю `order` (0 = первый)
   - Можно использовать любые числа для гибкой сортировки

5. **Автоматические значения:**
   - `order` по умолчанию: `0`
   - `isActive` по умолчанию: `true`
   - `id` генерируется автоматически (UUID)

6. **Авторизация:**
   - Все эндпоинты требуют AdminGuard
   - Токен передается в заголовке `Authorization: Bearer <token>`

7. **Формат имен файлов:**
   - Desktop изображение: `desktop-banner-{id}-{timestamp}.{ext}`
   - Mobile изображение: `mobile-banner-{id}-{timestamp}.{ext}`

8. **Рекомендуемые размеры изображений:**
   - Desktop: 1920x600px
   - Mobile: 768x768px
