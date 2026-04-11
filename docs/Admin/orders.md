# API админ-панели: Заказы

**Базовый URL:** `/api/admin/orders`

**Требуется авторизация:** Admin Bearer Token (через Telegram)

```
Authorization: Bearer YOUR_ADMIN_JWT
```

---

## 1. Статистика заказов

**GET** `/api/admin/orders/stats`

Общая статистика по заказам для дашборда.

### Response:
```json
{
  "totalOrders": 150,
  "paidOrders": 120,
  "todayOrders": 8,
  "totalRevenue": 1250000,
  "byStatus": {
    "PENDING": 3,
    "CONFIRMED": 45,
    "PROCESSING": 20,
    "SHIPPED": 30,
    "DELIVERED": 50,
    "CANCELLED": 2
  }
}
```

### Поля:
- **totalOrders** — всего заказов
- **paidOrders** — оплаченных заказов
- **todayOrders** — заказов за сегодня
- **totalRevenue** — общая выручка (оплаченные, без отменённых)
- **byStatus** — распределение заказов по статусам

---

## 2. Список заказов

**GET** `/api/admin/orders`

Получить список всех заказов с фильтрами и пагинацией.

### Query параметры:
| Параметр | Тип | Описание |
|----------|-----|----------|
| `status` | `OrderStatus` | Фильтр по статусу (PENDING, CONFIRMED, etc.) |
| `isPaid` | `boolean` | Только оплаченные / неоплаченные |
| `search` | `string` | Поиск по номеру заказа, имени, email, телефону |
| `dateFrom` | `ISO date` | Заказы от даты |
| `dateTo` | `ISO date` | Заказы до даты |
| `page` | `number` | Номер страницы (default: 1) |
| `limit` | `number` | Размер страницы (default: 20) |

### Пример:
```bash
curl "https://saliy-shop.ru/api/admin/orders?status=CONFIRMED&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response:
```json
{
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "SALIY2603290001",
      "firstName": "Иван",
      "lastName": "Петров",
      "email": "test@example.com",
      "phone": "+375291234567",
      "socialContact": "Telegram: @ivan_petrov",
      "comment": "Упаковать в подарочную упаковку",
      "deliveryType": "STANDARD",
      "paymentMethod": "CARD_ONLINE",
      "originalSubtotal": 9500,
      "subtotal": 8550,
      "deliveryTotal": 800,
      "discountAmount": 855,
      "total": 8495,
      "status": "CONFIRMED",
      "isPaid": true,
      "currency": "RUB",
      "createdAt": "2026-03-29T12:00:00.000Z",
      "items": [...],
      "promoCode": {
        "code": "SALE10",
        "type": "PERCENTAGE",
        "value": 10
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 3. Получить заказ по номеру

**GET** `/api/admin/orders/:orderNumber`

Получить детальную информацию о заказе, включая данные пользователя (если был авторизован).

### Response:
```json
{
  "id": "uuid",
  "orderNumber": "SALIY2603290001",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "Иван",
    "lastName": "Петров"
  },
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "comment": "Упаковать в подарочную упаковку",
  "originalSubtotal": 9500,
  "subtotal": 8550,
  "deliveryTotal": 800,
  "discountAmount": 855,
  "total": 8495,
  "status": "CONFIRMED",
  "isPaid": true,
  "items": [...],
  "promoCode": {
    "code": "SALE10",
    "type": "PERCENTAGE",
    "value": 10
  }
}
```

---

## 4. Обновить поля заказа

**PATCH** `/api/admin/orders/:orderNumber`

Обновление произвольных полей заказа (контакты клиента, адрес, доставка, комментарий). Все поля опциональны — передавайте только те, что нужно изменить.

### Доступные поля:

**Клиент:**
- `firstName`, `lastName`, `phone`, `email`, `socialContact`, `comment`

**Адрес:**
- `countryName`, `regionName`, `cityName`, `cdekCityCode`
- `street`, `apartment`, `postalCode`, `pickupPoint`

**Доставка и оплата:**
- `deliveryType` — `CDEK_PICKUP` / `STANDARD`
- `paymentMethod` — `CARD_ONLINE` / `CARD_MANUAL` / `CRYPTO` / `PAYPAL`
- `deliveryPrice`, `deliveryTotal`
- `isPaid`, `paymentId`

### Пример:
```bash
curl -X PATCH https://saliy-shop.ru/api/admin/orders/SALIY2603290001 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+375291234999",
    "street": "ул. Новая",
    "apartment": "15",
    "comment": "Уточнение от клиента: звонить после 18:00"
  }'
```

### Response:
Обновлённый объект заказа.

### Ошибки:
- `404` — заказ не найден

> **Важно:** для смены статуса используйте отдельный endpoint `PATCH /:orderNumber/status`. Для отмены — `POST /:orderNumber/cancel`. Этот endpoint **не** меняет `status` и `total`.

---

## 5. Изменить статус заказа

**PATCH** `/api/admin/orders/:orderNumber/status`

Обновить статус заказа. Нельзя менять статус отменённых заказов.

### Доступные статусы:
- `PENDING` — ожидает оплаты
- `PAYMENT_FAILED` — ошибка оплаты
- `CONFIRMED` — подтверждён
- `PROCESSING` — в обработке
- `SHIPPED` — отправлен
- `DELIVERED` — доставлен
- `CANCELLED` — отменён (⚠️ для отмены используйте отдельный endpoint)
- `REFUNDED` — возвращён

### Request:
```json
{
  "status": "SHIPPED"
}
```

### Response:
Обновлённый объект заказа.

### Ошибки:
- `404` — заказ не найден
- `400` — попытка изменить статус отменённого заказа

---

## 6. Отменить заказ

**POST** `/api/admin/orders/:orderNumber/cancel`

Отменяет заказ и **возвращает остатки на склад** (товары снова доступны для покупки). Также уменьшает счётчик `salesCount` у товаров.

### Request:
```json
{
  "reason": "Клиент передумал"
}
```

Поле `reason` опционально — пишется только в логи.

### Response:
Обновлённый объект заказа со `status: "CANCELLED"`.

### Ошибки:
- `404` — заказ не найден
- `400` — заказ уже отменён
- `400` — нельзя отменить доставленный заказ

### Что происходит при отмене:
1. ✅ Статус заказа меняется на `CANCELLED`
2. ✅ Остатки товаров возвращаются на склад (по размерам)
3. ✅ Счётчик `salesCount` у товаров уменьшается
4. ✅ Всё выполняется в транзакции — либо всё, либо ничего

---

## 7. Оформить возврат

**POST** `/api/admin/orders/:orderNumber/refund`

Переводит заказ в статус `REFUNDED`. Причина дописывается в поле `comment` заказа с префиксом `[ВОЗВРАТ]:`.

### Request:
```json
{
  "reason": "Брак товара, клиент вернул обратно"
}
```

### Ошибки:
- `400` — нельзя вернуть неоплаченный заказ
- `400` — заказ уже возвращён

> **Отличие от `cancel`:** `cancel` возвращает остатки на склад (для неотправленных заказов); `refund` — для уже оплаченных/доставленных заказов, склад не трогает.

---

## 8. Обновить CDEK-информацию

**PATCH** `/api/admin/orders/:orderNumber/cdek`

Ручное обновление CDEK-данных заказа (например, после создания накладной в панели CDEK).

### Request (все поля опциональны):
```json
{
  "cdekNumber": "1234567890",
  "cdekUuid": "uuid-from-cdek",
  "cdekStatus": "ACCEPTED",
  "cdekStatusName": "Принят на склад"
}
```

При передаче `cdekStatus` автоматически обновляется `cdekStatusDate`.

---

## 9. Отправить письмо клиенту

**POST** `/api/admin/orders/:orderNumber/send-email`

Отправляет произвольное email клиенту по данному заказу (например, "ваш заказ задерживается").

### Request:
```json
{
  "subject": "Задержка доставки заказа",
  "message": "Здравствуйте! К сожалению, ваш заказ задерживается на 2 дня. Приносим извинения."
}
```

### Response:
```json
{ "success": true, "sentTo": "client@example.com" }
```

Email отправляется в шаблоне с обращением к клиенту и номером заказа.

---

## 10. Экспорт заказов в CSV

**GET** `/api/admin/orders/export.csv`

Принимает те же query-фильтры, что `GET /api/admin/orders` (status, isPaid, search, dateFrom, dateTo).

### Пример:
```bash
curl "https://saliy-shop.ru/api/admin/orders/export.csv?status=DELIVERED&dateFrom=2026-01-01" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o orders.csv
```

Возвращает CSV-файл (UTF-8 с BOM, разделитель `;`) со столбцами:
`Номер заказа; Дата; Клиент; Email; Телефон; Статус; Оплачен; Товаров; Сумма; Валюта; Доставка; Промокод`

Максимум 10000 строк за один запрос.

---

## OrderStatus — жизненный цикл заказа

```
PENDING ──┬──► CONFIRMED ──► PROCESSING ──► SHIPPED ──► DELIVERED
          │                                                  │
          │                                                  ▼
          └──► PAYMENT_FAILED                            REFUNDED

                    Любой из них ──► CANCELLED (кроме DELIVERED)
```
