# API баннеров

API для управления баннерами магазина (главная страница и категории товаров).

---

## Структура данных

```typescript
{
  id: string;                  // UUID
  title: string;               // Название баннера (для админки)
  description?: string;        // Описание (опционально)
  desktopImageUrl: string;     // URL изображения для десктопа
  mobileImageUrl: string;      // URL изображения для мобильной версии
  link?: string;               // Ссылка при клике (опционально)
  categoryId?: number;         // ID категории (null = главная страница)
  order: number;               // Порядок отображения (0 = первый)
  isActive: boolean;           // Активен ли баннер
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Логика работы

### Типы баннеров:
1. **Баннеры главной страницы** - `categoryId = null`
2. **Баннеры категорий** - `categoryId = ID категории`

### Примеры использования:
- Баннеры для главной страницы: слайдер на главной
- Баннеры для категории "Куртки": слайдер в каталоге курток
- Баннеры для категории "Штаны": слайдер в каталоге штанов

---

## Эндпоинты

### 1. Создать баннер

**POST** `/api/banners`

**Требуется:** multipart/form-data

**Параметры:**
- `title` (string, обязательно) - Название баннера
- `description` (string, опционально) - Описание
- `link` (string, опционально) - Ссылка при клике
- `categoryId` (number, опционально) - ID категории (null = главная страница)
- `order` (number, опционально) - Порядок отображения (по умолчанию 0)
- `isActive` (boolean, опционально) - Активен ли (по умолчанию true)
- `desktopImage` (file, обязательно) - Изображение для десктопа
- `mobileImage` (file, обязательно) - Изображение для мобильной версии

**Пример запроса (curl):**
```bash
curl -X POST https://saliy-shop.ru/api/banners \
  -F "title=Зимняя коллекция курток" \
  -F "description=Скидка 20% на все куртки" \
  -F "link=/catalog/kurtki" \
  -F "categoryId=1" \
  -F "order=0" \
  -F "isActive=true" \
  -F "desktopImage=@/path/to/desktop.jpg" \
  -F "mobileImage=@/path/to/mobile.jpg"
```

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "title": "Зимняя коллекция курток",
  "description": "Скидка 20% на все куртки",
  "desktopImageUrl": "/uploads/banners/desktop-1234567890.jpg",
  "mobileImageUrl": "/uploads/banners/mobile-1234567890.jpg",
  "link": "/catalog/kurtki",
  "categoryId": 1,
  "order": 0,
  "isActive": true,
  "createdAt": "2024-03-28T10:00:00.000Z",
  "updatedAt": "2024-03-28T10:00:00.000Z"
}
```

---

### 2. Получить все баннеры

**GET** `/api/banners`

Возвращает все баннеры (для админки).

**Пример запроса:**
```bash
curl https://saliy-shop.ru/api/banners
```

---

### 3. Получить активные баннеры

**GET** `/api/banners/active`

Возвращает все активные баннеры (isActive = true).

---

### 4. Получить баннеры для главной страницы

**GET** `/api/banners/active/main`

Возвращает только активные баннеры для главной страницы (categoryId = null).

**Пример запроса:**
```bash
curl https://saliy-shop.ru/api/banners/active/main
```

**Пример ответа:**
```json
[
  {
    "id": "uuid-123",
    "title": "Главный баннер 1",
    "desktopImageUrl": "/uploads/banners/desktop-1234567890.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-1234567890.jpg",
    "link": "/new-collection",
    "categoryId": null,
    "order": 0,
    "isActive": true
  },
  {
    "id": "uuid-456",
    "title": "Главный баннер 2",
    "desktopImageUrl": "/uploads/banners/desktop-0987654321.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-0987654321.jpg",
    "link": "/sale",
    "categoryId": null,
    "order": 1,
    "isActive": true
  }
]
```

---

### 5. Получить баннеры для категории

**GET** `/api/banners/active/category/:categoryId`

Возвращает только активные баннеры для указанной категории.

**Пример запроса:**
```bash
# Получить баннеры для категории "Куртки" (ID = 1)
curl https://saliy-shop.ru/api/banners/active/category/1
```

**Пример ответа:**
```json
[
  {
    "id": "uuid-789",
    "title": "Зимняя коллекция курток",
    "description": "Скидка 20% на все куртки",
    "desktopImageUrl": "/uploads/banners/desktop-1111111111.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-1111111111.jpg",
    "link": "/catalog/kurtki",
    "categoryId": 1,
    "order": 0,
    "isActive": true
  }
]
```

---

### 6. Получить один баннер по ID

**GET** `/api/banners/:id`

**Пример запроса:**
```bash
curl https://saliy-shop.ru/api/banners/uuid-123
```

---

### 7. Обновить баннер

**PUT** `/api/banners/:id`

**Требуется:** multipart/form-data

Можно обновить любые поля, включая изображения (опционально).

**Параметры (все опциональны):**
- `title` - Название
- `description` - Описание
- `link` - Ссылка
- `categoryId` - ID категории
- `order` - Порядок
- `isActive` - Активность
- `desktopImage` - Новое изображение для десктопа (если нужно заменить)
- `mobileImage` - Новое изображение для мобильной версии (если нужно заменить)

**Пример запроса:**
```bash
# Обновить только название и порядок
curl -X PUT https://saliy-shop.ru/api/banners/uuid-123 \
  -F "title=Новое название" \
  -F "order=5"

# Обновить только десктоп изображение
curl -X PUT https://saliy-shop.ru/api/banners/uuid-123 \
  -F "desktopImage=@/path/to/new-desktop.jpg"
```

---

### 8. Удалить баннер

**DELETE** `/api/banners/:id`

Удаляет баннер и его изображения с сервера.

**Пример запроса:**
```bash
curl -X DELETE https://saliy-shop.ru/api/banners/uuid-123
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные или отсутствуют обязательные изображения |
| 404 | Баннер не найден |
| 500 | Ошибка сервера |

---

## Примеры использования

### Сценарий 1: Добавить баннеры на главную страницу

```bash
# Баннер 1 - Новая коллекция
curl -X POST https://saliy-shop.ru/api/banners \
  -F "title=Новая зимняя коллекция" \
  -F "link=/new-collection" \
  -F "order=0" \
  -F "desktopImage=@banner1-desktop.jpg" \
  -F "mobileImage=@banner1-mobile.jpg"

# Баннер 2 - Скидки
curl -X POST https://saliy-shop.ru/api/banners \
  -F "title=Скидка 30%" \
  -F "link=/sale" \
  -F "order=1" \
  -F "desktopImage=@banner2-desktop.jpg" \
  -F "mobileImage=@banner2-mobile.jpg"
```

### Сценарий 2: Добавить баннеры для категории "Куртки"

```bash
# Предположим, категория "Куртки" имеет ID = 1

# Баннер для категории курток
curl -X POST https://saliy-shop.ru/api/banners \
  -F "title=Зимние куртки" \
  -F "categoryId=1" \
  -F "link=/catalog/kurtki/winter" \
  -F "order=0" \
  -F "desktopImage=@kurtki-banner-desktop.jpg" \
  -F "mobileImage=@kurtki-banner-mobile.jpg"
```

### Сценарий 3: Добавить баннеры для категории "Штаны"

```bash
# Предположим, категория "Штаны" имеет ID = 2

curl -X POST https://saliy-shop.ru/api/banners \
  -F "title=Новые штаны" \
  -F "categoryId=2" \
  -F "link=/catalog/shtany" \
  -F "order=0" \
  -F "desktopImage=@shtany-banner-desktop.jpg" \
  -F "mobileImage=@shtany-banner-mobile.jpg"
```

### Сценарий 4: Отобразить баннеры на фронтенде

```javascript
// Главная страница
fetch('https://saliy-shop.ru/api/banners/active/main')
  .then(res => res.json())
  .then(banners => {
    // Показать баннеры в слайдере
    banners.forEach(banner => {
      console.log(banner.desktopImageUrl); // Для десктопа
      console.log(banner.mobileImageUrl);  // Для мобильной версии
    });
  });

// Страница категории "Куртки" (categoryId = 1)
fetch('https://saliy-shop.ru/api/banners/active/category/1')
  .then(res => res.json())
  .then(banners => {
    // Показать баннеры категории
  });
```

---

## Требования к изображениям

### Рекомендуемые размеры:
- **Desktop**: 1920x600px
- **Mobile**: 768x768px

### Форматы:
- JPG, PNG, WebP
- Максимальный размер файла: 5MB

---

## См. также

- [Категории товаров](./categories.md)
- [Товары](./products.md)
