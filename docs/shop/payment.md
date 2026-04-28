# API оплаты

## Текущее состояние

Две онлайн-платёжки, на выбор пользователю:

| `paymentMethod` | Через что | Тестовый шлюз |
|---|---|---|
| `CARD_ONLINE` | **Альфа-Банк** (Alfa RBS) | `alfa.rbsuat.com` |
| `YANDEX_PAY` | **Яндекс Пэй** | `sandbox.pay.yandex.ru` |
| `CARD_MANUAL` / `CRYPTO` / `PAYPAL` | Ручная обработка менеджером | — |

Для онлайн-платежей (Альфа и Яндекс) заказ создаётся в `PENDING`, в ответе возвращается `paymentUrl` для редиректа клиента. Для остальных — `CONFIRMED` сразу.

---

## Как выглядит оплата через Альфа-Банк

### Flow

```
Клиент            Backend              Alfa RBS           Email
  |                  |                    |                 |
  |  POST /orders    |                    |                 |
  | (CARD_ONLINE)    |                    |                 |
  |----------------->|                    |                 |
  |                  | validate items     |                 |
  |                  | create order       |                 |
  |                  | (status=PENDING)   |                 |
  |                  |                    |                 |
  |                  | register.do        |                 |
  |                  |------------------->|                 |
  |                  |<-- {orderId,       |                 |
  |                  |     formUrl}       |                 |
  |                  |                    |                 |
  |                  | send order email   |                 |
  |                  |---------------------------------->   |
  |                  |                    |                 |
  | {order, ...,     |                    |                 |
  |  paymentUrl} <---|                    |                 |
  |                  |                    |                 |
  | redirect → formUrl                    |                 |
  |-------------------------------------->|                 |
  |                  |                    |                 |
  |                  |  пользователь вводит карту, 3DS и т.п.
  |                  |                    |                 |
  | ← redirect returnUrl/failUrl          |                 |
  |<--------------------------------------|                 |
  |                  |                    |                 |
  |                  | GET /payment/alfa/callback (от банка)|
  |                  |<-------------------|                 |
  |                  | getOrderStatusExt. |                 |
  |                  |------------------->|                 |
  |                  |<-- {orderStatus:2} |                 |
  |                  | update order       |                 |
  |                  | status=CONFIRMED   |                 |
  |                  | isPaid=true        |                 |
```

### Что возвращает `POST /api/orders` для `CARD_ONLINE`

Обычный ответ заказа (см. [orders.md](./orders.md#3-создать-заказ)) + поле `paymentUrl`:

```json
{
  "id": "uuid",
  "orderNumber": "SALIY2604240001",
  "status": "PENDING",
  "isPaid": false,
  "paymentId": "1a2b3c4d-5e6f-...",
  "paymentMethod": "CARD_ONLINE",
  "total": 8495,
  "paymentUrl": "https://alfa.rbsuat.com/payment/merchants/.../payment_ru.html?mdOrder=1a2b3c4d-..."
}
```

**Фронт** после получения ответа:
1. Если `paymentMethod === 'CARD_ONLINE'` и есть `paymentUrl` → `window.location.href = paymentUrl`.
2. Для остальных методов (`CARD_MANUAL` и т.п.) → показать страницу «Заказ оформлен».

### Статусы заказа при оплате через Альфа

| Статус                 | Что значит                                        |
|------------------------|---------------------------------------------------|
| `PENDING`              | Заказ создан, ждёт оплаты                         |
| `PAYMENT_FAILED`       | Платёж отклонён / регистрация в банке не удалась  |
| `CONFIRMED` + `isPaid: true` | Деньги списаны, заказ подтверждён           |
| `CANCELLED`            | Авторизация отменена                              |
| `REFUNDED`             | Возврат выполнен                                  |

---

## Endpoints

### 1. Callback от Альфа-Банка

**GET** `/api/payment/alfa/callback`

Банк вызывает этот URL после изменения статуса платежа.

Query-параметры: `mdOrder`, `orderNumber`, `operation` (deposited/approved/reversed/refunded/declinedByTimeout), `status` (1 — ок, 0 — ошибка), `checksum`.

Поведение backend'а:
- Дергает `getOrderStatusExtended.do` у Альфы, чтобы достоверно узнать статус.
- Обновляет `status` и `isPaid` заказа в БД.
- Отвечает `200 OK`.

> **Примечание:** URL нужно прописать в личном кабинете Альфы как адрес уведомлений об изменении статуса.

---

### 2. Ручная синхронизация статуса

**POST** `/api/payment/alfa/check-status`

Если callback не пришёл (сеть, timeout банка), можно подтянуть статус вручную.

```bash
curl -X POST https://saliy-shop.ru/api/payment/alfa/check-status \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"SALIY2604240001"}'
```

```json
{
  "orderNumber": "SALIY2604240001",
  "orderStatus": 2,
  "status": "PAID"
}
```

Одновременно обновляет запись заказа в БД.

---

## Маппинг статусов Альфа

`orderStatus` из `getOrderStatusExtended.do`:

| Код | Смысл Альфы                     | Наш внутренний статус |
|-----|---------------------------------|-----------------------|
| `0` | Заказ зарегистрирован, не оплачен | `PENDING`             |
| `1` | Предавторизована                 | `PENDING`             |
| `2` | Авторизована (списано)           | `PAID` → `CONFIRMED`  |
| `3` | Авторизация отменена             | `CANCELED` → `CANCELLED` |
| `4` | Возврат                          | `REFUNDED`            |
| `5` | Инициирована через ACS           | `PENDING`             |
| `6` | Отклонена                        | `FAILED` → `PAYMENT_FAILED` |

---

## Настройка

### Env-переменные

```env
# Тестовый шлюз (UAT)
ALFA_BASE_URL=https://alfa.rbsuat.com
ALFA_API_USERNAME=r-saliyclothes_vercel-api
ALFA_API_PASSWORD=saliyclothes_vercel*?1

# Продакшн (раскомментировать и заменить логин/пароль)
# ALFA_BASE_URL=https://pay.alfabank.ru
# ALFA_API_USERNAME=...
# ALFA_API_PASSWORD=...

# Для формирования returnUrl/failUrl:
FRONTEND_URL=https://saliyclothes.vercel.app/
```

### URL возврата клиента после оплаты

Формируются автоматически:
- `returnUrl`: `${FRONTEND_URL}/order/{orderNumber}?payment=success`
- `failUrl`:   `${FRONTEND_URL}/order/{orderNumber}?payment=fail`

Фронт на странице `order/:orderNumber` читает query-параметр `payment`:
- `success` → показать «Оплата прошла», при необходимости дёрнуть `POST /api/payment/alfa/check-status` для актуализации статуса.
- `fail`    → «Оплата не прошла, попробуйте ещё раз» + ссылка на повтор заказа.

---

## Тестовые карты Альфы (UAT)

| Номер карты         | Результат             |
|---------------------|-----------------------|
| `4111 1111 1111 1111` | Успешная оплата     |
| `5555 5555 5555 4444` | Успешная оплата (MC)|
| `4000 0000 0000 0002` | Отказ банка         |

- Срок: любая будущая дата.
- CVC/CVV: любые 3 цифры.
- 3DS пароль: `12345678` (если запрашивается).

> Актуальный набор карт — в документации Альфы: <https://pay.alfabank.ru/ecommerce/instructions/merchantManual/pages/index/testCards.html>

---

## Безопасность

- Подпись callback (параметр `checksum`) **не проверяется** — для этого нужен отдельный секретный ключ, который выдают не все тарифы. Вместо проверки подписи мы делаем обратный запрос `getOrderStatusExtended.do` и доверяем только ответу банка.
- `userName`/`password` от Альфы — только в `.env`, не коммитятся.
- Сумма берётся из БД (с учётом валидации товаров/промокодов/доставки) — клиент не может подсунуть свою цену.
- Номер заказа (`orderNumber`) уникален за день (`SALIYYYMMDDXXXXX`).

---

## Известные ограничения и TODO

- ❌ Повторная регистрация платежа с тем же `orderNumber` — Альфа вернёт ошибку. На стороне фронта если оплата не прошла, создаём новый заказ.
- ❌ Подпись callback не проверяется (см. «Безопасность»).
- ⏳ Возвраты (`refund.do`) — не реализованы, добавить при необходимости.
- ⏳ Reversal (`reverse.do`) для отмены авторизации — не реализованы.
- ⏳ Email о подтверждении оплаты (когда `isPaid` меняется на `true`) — сейчас отправляется только email о создании заказа.

---

## Яндекс Пэй

### Endpoint'ы

- **Sandbox:** `https://sandbox.pay.yandex.ru/api/merchant`
- **Prod:** `https://pay.yandex.ru/api/merchant`

### Что отправляем при регистрации заказа

`POST {base}/v1/orders` с заголовком `Authorization: Api-Key {API_KEY}`.

```json
{
  "orderId": "SALIY2604240001",
  "currencyCode": "RUB",
  "merchantId": "ae13d8a3-...",
  "orderAmount": "8495.00",
  "cart": {
    "items": [
      {
        "productId": "20",
        "title": "Джинсовка SALIY чёрная",
        "quantity": { "count": "1.00" },
        "unitPrice": "8550.00",
        "total": "8550.00"
      }
    ],
    "total": { "amount": "8495.00" }
  },
  "redirectUrls": {
    "onSuccess": "https://saliyclothes.vercel.app/order/SALIY2604240001?payment=success",
    "onError":   "https://saliyclothes.vercel.app/order/SALIY2604240001?payment=fail",
    "onAbort":   "https://saliyclothes.vercel.app/order/SALIY2604240001?payment=fail"
  },
  "availablePaymentMethods": ["CARD", "SPLIT", "SBP"]
}
```

> **Особенности:** суммы — строки с двумя знаками (`"8495.00"`); валюта — буквенная (`"RUB"`); `quantity.count` — тоже строка.

Ответ:
```json
{ "status": "success", "data": { "paymentUrl": "https://...", "orderId": "yandex-internal-id" } }
```

`paymentUrl` уходит клиенту, наш `orderNumber` сохраняем в `order.paymentId`.

---

### Endpoints в backend'е

#### Webhook от Яндекс Пэй

**POST** `/api/payment/yandex/webhook`

Яндекс шлёт `application/octet-stream` с **JWT-токеном** (ES256) внутри. Backend декодирует payload (без проверки подписи!) и для надёжности pull-ом подтверждает статус через `GET /v1/orders/{orderId}`. Это аналогично подходу Альфы.

События в payload:
- `ORDER_STATUS_UPDATED` — изменился статус заказа
- `OPERATION_STATUS_UPDATED` — изменился статус операции (списание/возврат/отмена)

> **Настройка в кабинете Яндекса:** добавь Callback URL: `https://saliy-shop.ru/api/payment/yandex/webhook`. Backend всегда отвечает `200 OK { status: "success" }`, иначе Яндекс будет ретраить с экспоненциальным бэкоффом 24 часа.

#### Ручная синхронизация статуса

**POST** `/api/payment/yandex/check-status`

```bash
curl -X POST https://saliy-shop.ru/api/payment/yandex/check-status \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"SALIY2604240001"}'
```

```json
{
  "orderNumber": "SALIY2604240001",
  "yandexStatus": "CAPTURED",
  "status": "PAID"
}
```

---

### Маппинг статусов Яндекс Пэй

| Яндекс `order.status`  | Наш статус               |
|------------------------|--------------------------|
| `NEW`                  | `PENDING`                |
| `AUTHORIZED`           | `PENDING` (предавторизация) |
| `CAPTURED`             | `PAID` → `CONFIRMED`     |
| `VOIDED`               | `CANCELED` → `CANCELLED` |
| `REFUNDED`             | `REFUNDED`               |
| `PARTIALLY_REFUNDED`   | `REFUNDED`               |
| `FAILED`               | `FAILED` → `PAYMENT_FAILED` |

---

### Настройка `.env`

```env
# Тест
YANDEX_PAY_SANDBOX=true
YANDEX_PAY_MERCHANT_ID=ae13d8a3-f071-4365-9b42-b30a2838c7e7
YANDEX_PAY_API_KEY=ae13d8a3-f071-4365-9b42-b30a2838c7e7

# Прод (раскомментировать)
# YANDEX_PAY_SANDBOX=false
# YANDEX_PAY_MERCHANT_ID=<боевой merchantId>
# YANDEX_PAY_API_KEY=<боевой ключ из ЛК>
```

> В sandbox API_KEY === MERCHANT_ID. В проде это разные значения, ключ Merchant API получаешь в кабинете Яндекс Пэй.

---

### Что НЕ реализовано

- ❌ **Проверка подписи JWT (ES256)** — нужен публичный ключ Яндекса. Сейчас доверяем pull-запросу к API.
- ❌ Возвраты (`POST /v1/operations/.../refund`).
- ❌ Двухстадийные платежи (предавторизация + capture). Все платежи one-step.
