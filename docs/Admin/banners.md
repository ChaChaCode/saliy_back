# Управление баннерами главной страницы (Admin)

> **Требуется авторизация администратора** для всех операций в этом разделе.

## Структура баннера

```typescript
{
  id: string;                  // UUID
  title: string;               // Название баннера (для админки)
  description?: string;        // Описание (опционально)
  desktopImageUrl: string;     // URL изображения для десктопа
  mobileImageUrl: string;      // URL изображения для мобильной версии
  link?: string;               // Ссылка при клике (опционально)
  order: number;               // Порядок отображения (0 = первый)
  isActive: boolean;           // Активен ли баннер
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Эндпоинты

### 1. Создать баннер главной страницы

**POST** `/api/banners`

**Авторизация:**
```http
Authorization: Bearer <admin_token>
```

**Параметры (multipart/form-data):**
- `title` (string, обязательно) - Название баннера
- `description` (string, опционально) - Описание
- `link` (string, опционально) - Ссылка при клике
- `order` (number, опционально) - Порядок отображения (по умолчанию 0)
- `isActive` (boolean, опционально) - Активен ли (по умолчанию true)
- `desktopImage` (file, обязательно) - Изображение для десктопа
- `mobileImage` (file, обязательно) - Изображение для мобильной версии

**Пример запроса:**
```bash
curl -X POST https://saliy-shop.ru/api/banners \
  -H "Authorization: Bearer <admin_token>" \
  -F "title=Новая коллекция" \
  -F "description=Зимняя коллекция 2024" \
  -F "link=/catalog/new" \
  -F "order=0" \
  -F "isActive=true" \
  -F "desktopImage=@banner-desktop.jpg" \
  -F "mobileImage=@banner-mobile.jpg"
```

**Пример ответа:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Новая коллекция",
  "description": "Зимняя коллекция 2024",
  "desktopImageUrl": "/uploads/banners/desktop-1234567890.jpg",
  "mobileImageUrl": "/uploads/banners/mobile-1234567890.jpg",
  "link": "/catalog/new",
  "order": 0,
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

**Ошибки:**
- `400` - Не переданы обязательные поля или изображения
- `401` - Требуется авторизация администратора

---

### 2. Получить все баннеры (для админки)

**GET** `/api/banners`

**Авторизация:**
```http
Authorization: Bearer <admin_token>
```

Возвращает все баннеры (включая неактивные).

**Пример запроса:**
```bash
curl -X GET https://saliy-shop.ru/api/banners \
  -H "Authorization: Bearer <admin_token>"
```

**Пример ответа:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Новая коллекция",
    "description": "Зимняя коллекция 2024",
    "desktopImageUrl": "/uploads/banners/desktop-1234567890.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-1234567890.jpg",
    "link": "/catalog/new",
    "order": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Скидка 30%",
    "description": null,
    "desktopImageUrl": "/uploads/banners/desktop-9876543210.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-9876543210.jpg",
    "link": "/sale",
    "order": 1,
    "isActive": false,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
]
```

---

### 3. Получить баннер по ID

**GET** `/api/banners/:id`

**Авторизация:**
```http
Authorization: Bearer <admin_token>
```

**Пример запроса:**
```bash
curl -X GET https://saliy-shop.ru/api/banners/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <admin_token>"
```

**Ошибки:**
- `401` - Требуется авторизация администратора
- `404` - Баннер не найден

---

### 4. Обновить баннер

**PUT** `/api/banners/:id`

**Авторизация:**
```http
Authorization: Bearer <admin_token>
```

Можно обновить любые поля, включая изображения (опционально).

**Параметры (multipart/form-data):**
- `title` (string, опционально) - Название баннера
- `description` (string, опционально) - Описание
- `link` (string, опционально) - Ссылка при клике
- `order` (number, опционально) - Порядок отображения
- `isActive` (boolean, опционально) - Активен ли
- `desktopImage` (file, опционально) - Новое изображение для десктопа
- `mobileImage` (file, опционально) - Новое изображение для мобильной версии

**Пример запроса:**
```bash
# Обновить только текстовые поля
curl -X PUT https://saliy-shop.ru/api/banners/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <admin_token>" \
  -F "title=Обновлённое название" \
  -F "isActive=false"

# Обновить только изображение для десктопа
curl -X PUT https://saliy-shop.ru/api/banners/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <admin_token>" \
  -F "desktopImage=@new-desktop.jpg"
```

**Примечание:** При загрузке нового изображения старое автоматически удаляется.

**Ошибки:**
- `401` - Требуется авторизация администратора
- `404` - Баннер не найден

---

### 5. Удалить баннер

**DELETE** `/api/banners/:id`

**Авторизация:**
```http
Authorization: Bearer <admin_token>
```

**Пример запроса:**
```bash
curl -X DELETE https://saliy-shop.ru/api/banners/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <admin_token>"
```

**Примечание:** При удалении баннера все связанные файлы изображений также удаляются с диска.

**Ошибки:**
- `401` - Требуется авторизация администратора
- `404` - Баннер не найден

---

## Технические детали

### Хранение файлов
Баннеры главной страницы сохраняются в:
```
uploads/
  └── banners/
      ├── desktop-1234567890.jpg
      ├── mobile-1234567890.jpg
      └── ...
```

### Формат имени файла
- Desktop: `desktop-{timestamp}.{ext}`
- Mobile: `mobile-{timestamp}.{ext}`

### Требования к изображениям

**Рекомендуемые размеры:**
- Desktop: 1920x600px
- Mobile: 768x768px

**Форматы:**
- JPG, PNG, WebP
- Максимальный размер: 5MB

---

## Примеры использования

### Создать первый баннер главной страницы
```bash
curl -X POST https://saliy-shop.ru/api/banners \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "title=Новая зимняя коллекция" \
  -F "link=/new-collection" \
  -F "order=0" \
  -F "desktopImage=@banner1-desktop.jpg" \
  -F "mobileImage=@banner1-mobile.jpg"
```

### Создать второй баннер (распродажа)
```bash
curl -X POST https://saliy-shop.ru/api/banners \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "title=Скидка 30%" \
  -F "link=/sale" \
  -F "order=1" \
  -F "desktopImage=@banner2-desktop.jpg" \
  -F "mobileImage=@banner2-mobile.jpg"
```

### Деактивировать баннер
```bash
curl -X PUT https://saliy-shop.ru/api/banners/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "isActive=false"
```

### Удалить баннер
```bash
curl -X DELETE https://saliy-shop.ru/api/banners/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## См. также

- [Авторизация администратора](./auth.md)
- [Управление категориями](./categories.md)
