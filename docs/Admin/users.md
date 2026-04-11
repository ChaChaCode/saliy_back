# API админ-панели: Пользователи

**Базовый URL:** `/api/admin/users`

**Требуется авторизация:** Admin Bearer Token

---

## 1. Статистика пользователей

**GET** `/api/admin/users/stats`

### Response:
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

### Query параметры:
| Параметр | Тип | Описание |
|----------|-----|----------|
| `search` | `string` | Поиск по email, имени, фамилии, телефону |
| `dateFrom` | `ISO date` | Зарегистрированы от даты |
| `dateTo` | `ISO date` | Зарегистрированы до даты |
| `page` | `number` | Страница (default: 1) |
| `limit` | `number` | Размер страницы (default: 20) |

### Пример:
```bash
curl "https://saliy-shop.ru/api/admin/users?search=ivan&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response:
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "ivan@example.com",
      "firstName": "Иван",
      "lastName": "Петров",
      "phone": "+375291234567",
      "socialContact": "Telegram: @ivan_petrov",
      "createdAt": "2026-03-15T10:00:00.000Z",
      "ordersCount": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 523,
    "totalPages": 27
  }
}
```

---

## 3. Получить пользователя по ID

**GET** `/api/admin/users/:id`

Возвращает детальную информацию о пользователе, историю заказов и общую сумму покупок.

### Response:
```json
{
  "id": "uuid",
  "email": "ivan@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "middleName": null,
  "phone": "+375291234567",
  "birthdate": "1995-05-20T00:00:00.000Z",
  "socialContact": "Telegram: @ivan_petrov",
  "countryName": "Россия",
  "cityName": "Москва",
  "street": "ул. Ленина",
  "apartment": "42",
  "postalCode": "101000",
  "deliveryType": "CDEK",
  "cdekPickupPointCode": "MSK42",
  "createdAt": "2026-03-15T10:00:00.000Z",
  "ordersCount": 5,
  "cartItemsCount": 2,
  "totalSpent": 47500,
  "orders": [
    {
      "id": "order-uuid",
      "orderNumber": "SALIY2603290001",
      "status": "DELIVERED",
      "isPaid": true,
      "total": 8495,
      "currency": "RUB",
      "createdAt": "2026-03-29T12:00:00.000Z"
    }
  ]
}
```

### Поля:
- **ordersCount** — общее количество заказов
- **cartItemsCount** — товаров в корзине сейчас
- **totalSpent** — сумма оплаченных заказов (без отменённых)
- **orders** — история заказов (краткая инфа, для полной — `GET /api/admin/orders/:orderNumber`)

---

## 4. Удалить пользователя

**DELETE** `/api/admin/users/:id`

⚠️ **Осторожно:** Удаляет пользователя навсегда.

### Что происходит при удалении:
1. ✅ Удаляются: refresh токены, verification codes, корзина
2. ✅ **Заказы сохраняются** как гостевые (`userId = null`) — бухгалтерия не теряется
3. ✅ Всё выполняется в транзакции

### Response:
```json
{
  "success": true,
  "message": "Пользователь удалён, заказы сохранены как гостевые"
}
```

### Ошибки:
- `404` — пользователь не найден
