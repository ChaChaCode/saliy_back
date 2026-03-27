# Управление категориями (Admin)

> **Требуется авторизация администратора** для всех операций в этом разделе.

## Загрузка баннеров категории

### Загрузить/обновить баннеры категории

**PUT** `/api/categories/:id/banners`

Загружает или обновляет баннеры для категории.

**Авторизация:**
```http
Authorization: Bearer <admin_token>
```

**Параметры (multipart/form-data):**
- `desktopBanner` (file, опционально) - Изображение для десктопа
- `mobileBanner` (file, опционально) - Изображение для мобильной версии

**Примечание:** Можно загрузить оба баннера одновременно или обновить только один из них.

**Пример запроса:**
```bash
# Загрузить оба баннера
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -H "Authorization: Bearer <admin_token>" \
  -F "desktopBanner=@hoodies-desktop.jpg" \
  -F "mobileBanner=@hoodies-mobile.jpg"

# Обновить только десктопный баннер
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -H "Authorization: Bearer <admin_token>" \
  -F "desktopBanner=@new-desktop.jpg"

# Обновить только мобильный баннер
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -H "Authorization: Bearer <admin_token>" \
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
- `401` - Требуется авторизация администратора
- `404` - Категория не найдена

---

## Технические детали

### Хранение файлов
Баннеры категорий сохраняются в:
```
uploads/
  └── categories/
      ├── desktop-cat1-1234567890.jpg
      ├── mobile-cat1-1234567890.jpg
      └── ...
```

### Формат имени файла
- Desktop: `desktop-cat{categoryId}-{timestamp}.{ext}`
- Mobile: `mobile-cat{categoryId}-{timestamp}.{ext}`

### При загрузке нового баннера
- Старый файл автоматически удаляется с диска
- URL в базе данных обновляется на новый

### Требования к изображениям

**Рекомендуемые размеры:**
- Desktop: 1920x600px
- Mobile: 768x768px

**Форматы:**
- JPG, PNG, WebP
- Максимальный размер: 5MB

---

## Примеры использования

### Загрузить баннеры для категории "Толстовки"
```bash
curl -X PUT https://saliy-shop.ru/api/categories/1/banners \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "desktopBanner=@hoodies-desktop.jpg" \
  -F "mobileBanner=@hoodies-mobile.jpg"
```

### Обновить только мобильный баннер
```bash
curl -X PUT https://saliy-shop.ru/api/categories/2/banners \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "mobileBanner=@pants-mobile.jpg"
```

---

## См. также

- [Авторизация администратора](./auth.md)
- [Управление баннерами главной страницы](./banners.md)
