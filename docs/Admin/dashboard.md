# API админ-панели: Дашборд и статистика

**Базовый URL:** `/api/admin/dashboard`

**Требуется авторизация:** Admin Bearer Token

---

## 1. Общая сводка

**GET** `/api/admin/dashboard/overview`

Главная сводная статистика для главной страницы админки.

### Response:
```json
{
  "revenue": {
    "total": 1250000,
    "today": 8495,
    "thisWeek": 45000,
    "thisMonth": 180000,
    "thisYear": 950000,
    "averageOrderValue": 10416
  },
  "orders": {
    "total": 150,
    "today": 3,
    "thisWeek": 18,
    "thisMonth": 72,
    "pending": 2
  },
  "users": {
    "total": 523,
    "today": 4,
    "thisMonth": 87
  },
  "products": {
    "total": 85,
    "active": 72,
    "inactive": 13
  }
}
```

### Поля:
- **revenue.total** — вся выручка (оплаченные, не отменённые)
- **revenue.averageOrderValue** — средний чек
- **orders.pending** — заказы, ожидающие оплаты
- **products.inactive** — деактивированные товары

---

## 2. График выручки по периодам

**GET** `/api/admin/dashboard/revenue?period=month`

Данные для построения графиков выручки.

### Query параметры:
| `period` | Период | Группировка |
|----------|--------|-------------|
| `day` | Последние 24 часа | по часу |
| `week` | Последние 7 дней | по дню |
| `month` | Последние 30 дней (default) | по дню |
| `year` | Последние 12 месяцев | по месяцу |

### Пример:
```bash
curl "https://saliy-shop.ru/api/admin/dashboard/revenue?period=week" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response:
```json
{
  "period": "week",
  "startDate": "2026-04-04T10:00:00.000Z",
  "endDate": "2026-04-11T10:00:00.000Z",
  "data": [
    { "date": "2026-04-04", "revenue": 8495,  "orders": 1 },
    { "date": "2026-04-05", "revenue": 17100, "orders": 2 },
    { "date": "2026-04-06", "revenue": 0,     "orders": 0 },
    { "date": "2026-04-07", "revenue": 9500,  "orders": 1 },
    { "date": "2026-04-08", "revenue": 25600, "orders": 3 },
    { "date": "2026-04-09", "revenue": 8495,  "orders": 1 },
    { "date": "2026-04-10", "revenue": 17100, "orders": 2 }
  ]
}
```

> **Примечание:** учитываются только **оплаченные, не отменённые** заказы.

---

## 3. Топ продаваемых товаров

**GET** `/api/admin/dashboard/top-products?limit=10`

Список самых продаваемых товаров по количеству проданных единиц.

### Query параметры:
- `limit` — сколько товаров вернуть (default: 10)

### Response:
```json
[
  {
    "productId": 20,
    "name": "Джинсовка SALIY чёрная",
    "slug": "dzhinsovka-saliy-black",
    "price": 9500,
    "isActive": true,
    "imageUrl": {
      "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
      "isPreview": true,
      "previewOrder": 1
    },
    "soldCount": 47,
    "revenue": 446500
  }
]
```

### Поля:
- **soldCount** — сколько единиц продано (из оплаченных не отменённых заказов)
- **revenue** — выручка по этому товару (с учётом скидки товара)
- **isActive** — активен ли товар сейчас
- Если товар был удалён — `name: "Товар удалён"`, `slug: null`

---

## 4. Последние заказы

**GET** `/api/admin/dashboard/recent-orders?limit=10`

Лента последних созданных заказов для быстрого просмотра.

### Query параметры:
- `limit` — сколько заказов вернуть (default: 10)

### Response:
```json
[
  {
    "id": "uuid",
    "orderNumber": "SALIY2604110001",
    "customerName": "Иван Петров",
    "email": "ivan@example.com",
    "status": "CONFIRMED",
    "isPaid": true,
    "total": 8495,
    "currency": "RUB",
    "itemsCount": 2,
    "createdAt": "2026-04-11T10:30:00.000Z"
  }
]
```

> Для полной информации о заказе используйте `GET /api/admin/orders/:orderNumber`.

---

## Примечания

### Производительность
Все запросы дашборда параллельные (`Promise.all`) и используют агрегации Prisma без избыточной загрузки данных. Для больших объёмов данных рекомендуется кэшировать результаты `overview` на 1-2 минуты.

### Что считается выручкой
Везде, где упоминается revenue/total/средний чек — учитываются только заказы:
- `isPaid: true`
- `status != CANCELLED`
