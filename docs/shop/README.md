# API документация

Базовый URL: `https://saliy-shop.ru/api/`

## Модули

### [🔐 Авторизация и профиль](./auth.md)
- Авторизация по email с кодом подтверждения
- Управление профилем пользователя
- Адрес доставки

### [📁 Категории](./categories.md)
- Получение списка категорий
- Товары категории

### [🛍️ Товары](./products.md)
- Каталог товаров с фильтрацией
- Поиск товаров
- Популярные, новинки, распродажа
- Проверка наличия и цены

### [📦 Заказы](./orders.md)
- Создание заказа
- История заказов
- Отслеживание статуса

---

## Быстрый старт

### 1. Авторизация

```bash
# Отправить код
curl -X POST https://saliy-shop.ru/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Подтвердить код
curl -X POST https://saliy-shop.ru/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "code": "1234"}'

# Сохранить accessToken из ответа
```

### 2. Получить товары

```bash
# Все товары
curl https://saliy-shop.ru/api/products

# Товары категории
curl https://saliy-shop.ru/api/products?categorySlug=hoodies

# Популярные
curl https://saliy-shop.ru/api/products/popular

# Поиск
curl "https://saliy-shop.ru/api/products/search?q=толстовка"
```

### 3. Обновить профиль

```bash
curl -X PUT https://saliy-shop.ru/api/auth/profile \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+79991234567"
  }'
```

---

## Общие правила

### Авторизация
Для защищённых эндпоинтов используйте Bearer Token:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Пагинация
Параметры:
- `limit` - Количество элементов (по умолчанию 20)
- `offset` - Смещение

Пример:
```bash
curl "https://saliy-shop.ru/api/products?limit=20&offset=0"
```

### Коды ошибок
| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные |
| 401 | Не авторизован |
| 404 | Не найдено |
| 500 | Ошибка сервера |

### Формат ошибок
```json
{
  "statusCode": 400,
  "message": "Описание ошибки",
  "error": "Bad Request"
}
```

---

## Интеграции

### CDEK
- Расчёт стоимости доставки
- Поиск городов
- Поиск пунктов выдачи
- Создание заказа на доставку

### Email
- Коды подтверждения
- Уведомления о заказах (в разработке)

---

## Безопасность

- HTTPS обязателен
- Access Token: 15 минут
- Refresh Token: 7 дней, httpOnly cookie
- SQL-инъекции предотвращены через Prisma ORM
- Rate limiting на критичных операциях
- Валидация всех входящих данных
