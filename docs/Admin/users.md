# API админ-панели: Пользователи

**Базовый URL:** `/api/admin/users`

**Требуется авторизация:** Admin Bearer Token (`AdminGuard`)

Админ видит полный профиль пользователя: контакты, адрес, способ доставки, историю заказов с составом, оставленные отзывы, агрегаты (сколько потратил, когда последний заказ).

---

## Содержание

- [GET /api/admin/users/stats](#1-статистика-пользователей) — агрегаты для дашборда
- [GET /api/admin/users](#2-список-пользователей) — список с фильтрами/сортировкой
- [GET /api/admin/users/:id](#3-полная-карточка-пользователя) — все данные + заказы + отзывы
- [DELETE /api/admin/users/:id](#4-удалить-пользователя) — удаление (заказы/отзывы остаются)

---

## 1. Статистика пользователей

**GET** `/api/admin/users/stats`

```json
{
  "total": 523,
  "newToday": 4,
  "newThisMonth": 87,
  "withOrders": 312,
  "withoutOrders": 211
}
```

---

## 2. Список пользователей

**GET** `/api/admin/users`

Возвращает плоский список с агрегатами `ordersCount` / `totalSpent` / `lastOrderAt` по каждому юзеру — удобно для дашборда «топ покупателей».

### Query параметры:
| Параметр | Тип | Описание |
|----------|-----|----------|
| `search` | `string` | Поиск по email, `name`, `firstName`, `lastName`, `phone` (case-insensitive) |
| `dateFrom` / `dateTo` | `ISO date` | Диапазон регистрации |
| `hasOrders` | `true \| false` | Только с заказами / только без заказов |
| `sortBy` | `createdAt \| ordersCount \| totalSpent \| lastOrderAt` | По умолчанию `createdAt` |
| `sortOrder` | `asc \| desc` | По умолчанию `desc` |
| `page`, `limit` | `number` | Пагинация (default 1 / 20) |

> Сортировки по агрегатам (`ordersCount`/`totalSpent`/`lastOrderAt`) выполняются в памяти после фильтрации — на больших объёмах может быть медленно. Для `createdAt` сортировка идёт в БД.

### Примеры:
```bash
# ТОП покупателей по сумме
curl "https://saliy-shop.ru/api/admin/users?sortBy=totalSpent&hasOrders=true&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Поиск по email + последние заказы
curl "https://saliy-shop.ru/api/admin/users?search=ivan&sortBy=lastOrderAt" \
  -H "Authorization: Bearer $TOKEN"
```

### Response:
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "ivan@example.com",
      "name": null,
      "firstName": "Иван",
      "lastName": "Петров",
      "phone": "+375291234567",
      "avatarUrl": "https://storage.yandexcloud.net/saliy-shop/avatars/...",
      "socialContact": "Telegram: @ivan_petrov",
      "createdAt": "2026-03-15T10:00:00.000Z",
      "ordersCount": 5,
      "totalSpent": 47500,
      "lastOrderAt": "2026-04-20T14:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 523, "totalPages": 27 }
}
```

> `totalSpent` считается по **оплаченным** заказам (`isPaid=true`) в статусах ≠ `CANCELLED`.

---

## 3. Полная карточка пользователя

**GET** `/api/admin/users/:id`

### Response:
```json
{
  "id": "uuid",
  "email": "ivan@example.com",
  "name": "Иван",
  "firstName": "Иван",
  "lastName": "Петров",
  "middleName": null,
  "phone": "+375291234567",
  "avatarUrl": "https://storage.yandexcloud.net/saliy-shop/avatars/...",
  "birthdate": "1995-05-20T00:00:00.000Z",
  "socialContact": "Telegram: @ivan_petrov",

  "address": {
    "street": "ул. Ленина",
    "apartment": "42",
    "postalCode": "101000",
    "countryName": "Россия",
    "cityName": "Москва"
  },

  "delivery": {
    "deliveryType": "CDEK",
    "cdekCityCode": 44,
    "cdekCountryCode": "RU",
    "cdekRegionCode": 81,
    "cdekPickupPointCode": "MSK42"
  },

  "stats": {
    "ordersCount": 5,
    "cartItemsCount": 2,
    "totalSpent": 47500,
    "lastOrderAt": "2026-04-20T14:30:00.000Z"
  },

  "orders": [
    {
      "id": "order-uuid",
      "orderNumber": "SALIY2604200001",
      "status": "DELIVERED",
      "isPaid": true,
      "paymentMethod": "CARD_ONLINE",
      "total": 8495,
      "currency": "RUB",
      "deliveryType": "CDEK_PICKUP",
      "cdekStatus": "RECEIVED",
      "cdekStatusName": "Вручён",
      "createdAt": "2026-04-20T14:30:00.000Z",
      "items": [
        {
          "productId": 20,
          "name": "Джинсовка SALIY чёрная",
          "size": "M",
          "quantity": 1,
          "price": 9500,
          "discount": 10
        }
      ]
    }
  ],

  "reviews": [
    {
      "id": "review-uuid",
      "productId": 20,
      "rating": 5,
      "text": "Отличное качество!",
      "status": "APPROVED",
      "createdAt": "2026-04-22T10:00:00.000Z",
      "product": { "id": 20, "name": "Джинсовка SALIY чёрная", "slug": "dzhinsovka-saliy-black" }
    }
  ],

  "createdAt": "2026-03-15T10:00:00.000Z",
  "updatedAt": "2026-04-20T14:30:00.000Z"
}
```

### Структура
- **`address`** — домашний адрес (для стандартной доставки)
- **`delivery`** — настройки доставки, выбранные пользователем (CDEK-коды ПВЗ/города)
- **`stats`** — агрегаты: заказы, сумма, дата последнего заказа, товаров в корзине
- **`orders`** — все заказы с составом (items). Для полной инфы по одному заказу — `GET /api/admin/orders/:orderNumber`
- **`reviews`** — отзывы пользователя с привязкой к товару и статусом модерации (`PENDING` / `APPROVED` / `REJECTED`)

### Ошибки
- `404` — пользователь не найден

---

## 4. Удалить пользователя

**DELETE** `/api/admin/users/:id`

⚠️ Физическое удаление.

### Что происходит:
1. ✅ Удаляются: refresh-токены, verification codes, корзина (cascade)
2. ✅ **Заказы сохраняются** с `userId = null` (бухгалтерия не теряется)
3. ✅ **Отзывы сохраняются** с `userId = null` (оставленные отзывы остаются на товаре)
4. ✅ Всё в транзакции

### Response
```json
{
  "success": true,
  "message": "Пользователь удалён, заказы и отзывы сохранены (userId = null)"
}
```

### Ошибки
- `404` — пользователь не найден
