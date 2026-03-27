# API категорий

> **REST API** для базовых операций с категориями.
> Для расширенных возможностей и гибкости используйте [GraphQL API](./graphql.md).

## Структура категории

```typescript
{
  id: number;              // ID категории
  name: string;            // Название (уникальное)
  slug: string;            // URL slug (уникальный)
  type: category_type;     // Тип категории
  isActive: boolean;       // Активна ли категория
  desktopBannerUrl?: string; // URL баннера для десктопа
  mobileBannerUrl?: string;  // URL баннера для мобильной версии
  createdAt: Date;         // Дата создания
  updatedAt: Date;         // Дата обновления
}
```

### Типы категорий (category_type)
- `TOP` - Верхняя одежда (толстовки, футболки)
- `BOTTOM` - Нижняя одежда (штаны)
- `ACCESSORIES` - Аксессуары (кепки, сумки)
- `SPORT` - Спортивная одежда
- `OTHER` - Другое

---

## Эндпоинты

### 1. Получить все категории

**GET** `/api/categories`

**Пример запроса:**
```bash
curl -X GET https://saliy-shop.ru/api/categories
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "name": "Толстовки",
    "slug": "hoodies",
    "type": "TOP",
    "isActive": true,
    "desktopBannerUrl": "/uploads/categories/desktop-cat1-1234567890.jpg",
    "mobileBannerUrl": "/uploads/categories/mobile-cat1-1234567890.jpg",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  {
    "id": 2,
    "name": "Футболки",
    "slug": "tshirts",
    "type": "TOP",
    "isActive": true,
    "desktopBannerUrl": null,
    "mobileBannerUrl": null,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  {
    "id": 3,
    "name": "Штаны",
    "slug": "pants",
    "type": "BOTTOM",
    "isActive": true,
    "desktopBannerUrl": null,
    "mobileBannerUrl": null,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

---

### 2. Получить категорию по slug

**GET** `/api/categories/:slug`

**Пример запроса:**
```bash
curl -X GET https://saliy-shop.ru/api/categories/hoodies
```

**Пример ответа:**
```json
{
  "id": 1,
  "name": "Толстовки",
  "slug": "hoodies",
  "type": "TOP",
  "isActive": true,
  "desktopBannerUrl": "/uploads/categories/desktop-cat1-1234567890.jpg",
  "mobileBannerUrl": "/uploads/categories/mobile-cat1-1234567890.jpg",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}
```

**Ошибки:**
- `404` - Категория не найдена

---

### 3. Загрузить/обновить баннеры категории

**PUT** `/api/categories/:id/banners`

Загружает или обновляет баннеры для категории.

**Параметры (multipart/form-data):**
- `desktopBanner` (file, опционально) - Изображение для десктопа
- `mobileBanner` (file, опционально) - Изображение для мобильной версии

**⚠️ Важно:** Минимум одно из двух изображений обязательно!

**Пример запроса:**
```bash
# Загрузить оба баннера
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -F "desktopBanner=@hoodies-desktop.jpg" \
  -F "mobileBanner=@hoodies-mobile.jpg"

# Обновить только десктопный баннер
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -F "desktopBanner=@new-desktop.jpg"

# Обновить только мобильный баннер
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -F "mobileBanner=@new-mobile.jpg"
```

**Пример ответа:**
```json
{
  "id": 1,
  "name": "Толстовки",
  "slug": "hoodies",
  "type": "TOP",
  "isActive": true,
  "desktopBannerUrl": "/uploads/categories/desktop-cat1-1711234567890.jpg",
  "mobileBannerUrl": "/uploads/categories/mobile-cat1-1711234567890.jpg",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T12:30:00.000Z"
}
```

**Ошибки:**
- `400` - Не передано ни одно изображение
- `404` - Категория не найдена

**Примечания:**
- При загрузке нового баннера старый автоматически удаляется
- Файлы сохраняются в `uploads/categories/`
- Формат имени: `desktop-cat{id}-{timestamp}.ext` или `mobile-cat{id}-{timestamp}.ext`
- Поддерживаемые форматы: JPG, PNG, WebP
- Рекомендуемые размеры:
  - Desktop: 1920x600px
  - Mobile: 768x768px
- Максимальный размер файла: 5MB

---

### 4. Получить товары категории

**GET** `/api/categories/:slug/products`

**Query параметры:**
- `limit` - Количество товаров (по умолчанию 20)
- `offset` - Смещение для пагинации

**Пример запроса:**
```bash
curl -X GET "https://saliy-shop.ru/api/categories/hoodies/products?limit=10&offset=0"
```

**Пример ответа:**
```json
{
  "category": {
    "id": 1,
    "name": "Толстовки",
    "slug": "hoodies",
    "type": "TOP"
  },
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
        "M": 15
      },
      "isActive": true,
      "viewCount": 0,
      "salesCount": 0,
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

## Примеры использования

### Получить все активные категории
```bash
curl -X GET https://saliy-shop.ru/api/categories
```

### Получить категорию с баннерами
```bash
curl -X GET https://saliy-shop.ru/api/categories/hoodies
```

### Загрузить баннеры для категории
```bash
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -F "desktopBanner=@hoodies-desktop.jpg" \
  -F "mobileBanner=@hoodies-mobile.jpg"
```

### Получить товары категории "Толстовки"
```bash
curl -X GET https://saliy-shop.ru/api/categories/hoodies/products
```

### Получить товары категории с пагинацией
```bash
curl -X GET "https://saliy-shop.ru/api/categories/tshirts/products?limit=20&offset=20"
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные (например, не передано ни одно изображение) |
| 404 | Категория не найдена |
| 500 | Ошибка сервера |

---

## См. также

- [API баннеров](./banners.md) - Баннеры главной страницы
- [API товаров](./products.md) - Работа с товарами
