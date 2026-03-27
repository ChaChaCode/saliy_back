# API баннеров

API для получения баннеров магазина.

---

## Структура баннера

```typescript
{
  id: string;                  // UUID
  title: string;               // Название баннера
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

### Получить активные баннеры главной страницы

**GET** `/api/banners/active`

Возвращает только активные баннеры для главной страницы, отсортированные по полю `order`.

**Пример запроса:**
```bash
curl https://saliy-shop.ru/api/banners/active
```

**Пример ответа:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Новая зимняя коллекция",
    "description": "Скидки до 50%",
    "desktopImageUrl": "/uploads/banners/desktop-1234567890.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-1234567890.jpg",
    "link": "/new-collection",
    "order": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Распродажа",
    "description": null,
    "desktopImageUrl": "/uploads/banners/desktop-9876543210.jpg",
    "mobileImageUrl": "/uploads/banners/mobile-9876543210.jpg",
    "link": "/sale",
    "order": 1,
    "isActive": true,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
]
```

---

## Баннеры категорий

Баннеры категорий хранятся **внутри таблицы `categories`** как поля `desktopBannerUrl` и `mobileBannerUrl`.

Получить баннеры категории можно через:
- `GET /api/categories/:slug` - получить категорию с баннерами
- `GET /api/categories` - получить все категории с баннерами

См. [API категорий](./categories.md) для подробностей.

---

## Пример использования на фронтенде

```javascript
// Получить баннеры главной страницы
fetch('https://saliy-shop.ru/api/banners/active')
  .then(res => res.json())
  .then(banners => {
    banners.forEach(banner => {
      console.log(banner.title);
      console.log(banner.desktopImageUrl); // Для десктопа
      console.log(banner.mobileImageUrl);  // Для мобильной версии
      console.log(banner.link);            // Ссылка при клике
    });
  });

// Получить баннеры категории
fetch('https://saliy-shop.ru/api/categories/hoodies')
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
      ├── desktop-cat1-1234567890.jpg
      ├── mobile-cat1-1234567890.jpg
      └── ...
```

Все файлы доступны по URL: `https://saliy-shop.ru/uploads/...`

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 500 | Ошибка сервера |

---

## См. также

- [API категорий](./categories.md) - Категории с баннерами
- [API товаров](./products.md) - Товары