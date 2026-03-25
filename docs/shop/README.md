# API документация

Базовый URL: `https://saliy-shop.ru/api/`

## Модули

### [🔐 Авторизация](./auth.md) (REST)
- Авторизация по email с кодом подтверждения
- Access и Refresh токены

### [👤 Профиль пользователя](./user.md) (REST)
- Управление профилем пользователя
- Адрес доставки

### [🛍️ Товары и категории](./graphql.md) (GraphQL)
- **GraphQL API** для получения данных
- Каталог товаров с фильтрацией
- Поиск товаров
- Популярные, новинки, распродажа
- Категории

### [📁 Категории](./categories.md) (REST - устаревшее)
- Получение списка категорий (REST)
- Рекомендуется использовать GraphQL

### [🛍️ Товары](./products.md) (REST - устаревшее)
- Каталог товаров (REST)
- Рекомендуется использовать GraphQL
- REST оставлен для админки и проверки остатков

### [📦 Заказы](./orders.md) (в разработке)
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

### 2. Получить товары (GraphQL)

```bash
# Через GraphQL
curl -X POST https://saliy-shop.ru/api/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { products(categorySlug: \"hoodies\", limit: 10) { products { id name slug price finalPrice images } total } }"
  }'
```

Или открой GraphQL Playground: https://saliy-shop.ru/api/graphql

```graphql
query {
  products(categorySlug: "hoodies", limit: 10) {
    products {
      id
      name
      slug
      price
      finalPrice
      images
    }
    total
  }
}
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
