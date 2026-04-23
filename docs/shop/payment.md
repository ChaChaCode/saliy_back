# API оплаты

## Текущее состояние

- Подключена **тестовая платёжка Альфа-Банка** (Alfa RBS, `alfa.rbsuat.com`).
- Метод оплаты `CARD_ONLINE` → платёж идёт через Альфа-Банк.
- Остальные методы (`CARD_MANUAL`, `CRYPTO`, `PAYPAL`) — оплата вручную, заказ создаётся сразу в статусе `CONFIRMED` (`isPaid = true`).

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
