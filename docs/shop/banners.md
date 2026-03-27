# API баннеров

API для управления баннерами магазина.

---

## Структура

### 1. Баннеры главной страницы
Хранятся в таблице `banners`.

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

### 2. Баннеры категорий
Хранятся **внутри таблицы `categories`** как поля.

```typescript
{
  id: number;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  desktopBannerUrl?: string;   // URL десктопного баннера категории
  mobileBannerUrl?: string;    // URL мобильного баннера категории
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Эндпоинты для баннеров главной страницы

### 1. Создать баннер главной страницы

**POST** `/api/banners`

**Параметры (multipart/form-data):**
- `title` (string, обязательно) - Название баннера
- `description` (string, опционально) - Описание
- `link` (string, опционально) - Ссылка при клике
- `order` (number, опционально) - Порядок отображения (по умолчанию 0)
- `isActive` (boolean, опционально) - Активен ли (по умолчанию true)
- `desktopImage` (file, обязательно) - Изображение для десктопа
- `mobileImage` (file, обязательно) - Изображение для мобильной версии

**Пример:**
```bash
curl -X POST https://saliy-shop.ru/api/banners \
  -F "title=Новая коллекция" \
  -F "link=/catalog" \
  -F "order=0" \
  -F "desktopImage=@desktop.jpg" \
  -F "mobileImage=@mobile.jpg"
```

### 2. Получить все баннеры главной

**GET** `/api/banners`

Возвращает все баннеры (для админки).

### 3. Получить активные баннеры главной

**GET** `/api/banners/active`

Возвращает только активные баннеры для главной страницы.

**Пример:**
```bash
curl https://saliy-shop.ru/api/banners/active
```

### 4. Обновить баннер

**PUT** `/api/banners/:id`

Можно обновить любые поля, включая изображения (опционально).

### 5. Удалить баннер

**DELETE** `/api/banners/:id`

---

## Эндпоинты для баннеров категорий

### 1. Загрузить/обновить баннеры категории

**PUT** `/api/categories/:id/banners`

Загружает или обновляет баннеры для конкретной категории.

**Параметры (multipart/form-data):**
- `desktopBanner` (file, опционально) - Изображение для десктопа
- `mobileBanner` (file, опционально) - Изображение для мобильной версии

**⚠️ Важно:** Минимум одно из двух изображений обязательно!

**Пример:**
```bash
# Загрузить баннеры для категории "Куртки" (ID = 1)
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -F "desktopBanner=@kurtki-desktop.jpg" \
  -F "mobileBanner=@kurtki-mobile.jpg"

# Обновить только десктопный баннер
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -F "desktopBanner=@new-desktop.jpg"

# Обновить только мобильный баннер
curl -X PUT https://saliy-shop.ru/api/categories/2/banners \
  -F "mobileBanner=@new-mobile.jpg"
```

### 2. Получить категорию с баннерами

**GET** `/api/categories/:slug`

Возвращает информацию о категории, включая URL баннеров.

**Пример:**
```bash
curl https://saliy-shop.ru/api/categories/kurtki
```

**Ответ:**
```json
{
  "id": 1,
  "name": "Куртки",
  "slug": "kurtki",
  "type": "TOP",
  "isActive": true,
  "desktopBannerUrl": "/uploads/categories/desktop-cat1-1234567890.jpg",
  "mobileBannerUrl": "/uploads/categories/mobile-cat1-1234567890.jpg",
  "createdAt": "2024-03-28T10:00:00.000Z",
  "updatedAt": "2024-03-28T11:00:00.000Z"
}
```

---

## Примеры использования

### Сценарий 1: Настроить баннеры главной страницы

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

### Сценарий 2: Настроить баннеры для категорий

```bash
# Баннеры для категории "Куртки" (ID = 1)
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -F "desktopBanner=@kurtki-desktop.jpg" \
  -F "mobileBanner=@kurtki-mobile.jpg"

# Баннеры для категории "Штаны" (ID = 2)
curl -X PUT https://saliy-shop.ru/api/categories/2/banners \
  -F "desktopBanner=@shtany-desktop.jpg" \
  -F "mobileBanner=@shtany-mobile.jpg"
```

### Сценарий 3: Отображение на фронтенде

```javascript
// Главная страница
fetch('https://saliy-shop.ru/api/banners/active')
  .then(res => res.json())
  .then(banners => {
    banners.forEach(banner => {
      console.log(banner.desktopImageUrl); // Для десктопа
      console.log(banner.mobileImageUrl);  // Для мобильной версии
    });
  });

// Страница категории "Куртки"
fetch('https://saliy-shop.ru/api/categories/kurtki')
  .then(res => res.json())
  .then(category => {
    if (category.desktopBannerUrl) {
      console.log(category.desktopBannerUrl); // Десктопный баннер категории
    }
    if (category.mobileBannerUrl) {
      console.log(category.mobileBannerUrl); // Мобильный баннер категории
    }
  });
```

---

## Хранение файлов

### Баннеры главной страницы:
```
uploads/
  └── banners/
      ├── desktop-1234567890.jpg
      ├── mobile-1234567890.jpg
      └── ...
```

### Баннеры категорий:
```
uploads/
  └── categories/
      ├── desktop-cat1-1234567890.jpg  ← Куртки
      ├── mobile-cat1-1234567890.jpg
      ├── desktop-cat2-9876543210.jpg  ← Штаны
      ├── mobile-cat2-9876543210.jpg
      └── ...
```

Все файлы доступны по URL: `https://saliy-shop.ru/uploads/...`

---

## Требования к изображениям

**Рекомендуемые размеры:**
- Desktop: 1920x600px
- Mobile: 768x768px

**Форматы:**
- JPG, PNG, WebP
- Максимальный размер: 5MB

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные или отсутствуют обязательные изображения |
| 404 | Баннер или категория не найдена |
| 500 | Ошибка сервера |

---

## См. также

- [Категории товаров](./categories.md)
- [Товары](./products.md)
