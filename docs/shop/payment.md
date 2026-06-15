# API оплаты

## Текущее состояние

Две онлайн-платёжки, на выбор пользователю:

| `paymentMethod` | Через что | Тестовый шлюз |
|---|---|---|
| `CARD_ONLINE` | **Альфа-Банк** (Alfa RBS) | `alfa.rbsuat.com` |
| `YANDEX_PAY` | **Яндекс Пэй** | `sandbox.pay.yandex.ru` |
| `CARD_MANUAL` / `CRYPTO` / `PAYPAL` | Ручная обработка менеджером | — |

Для онлайн-платежей (Альфа и Яндекс) заказ создаётся в `PENDING`, в ответе возвращается `paymentUrl` для редиректа клиента. Для остальных методов — `CONFIRMED` сразу.

---

## Как выглядит оплата через Альфа-Банк

### Flow (по шагам)

1. Клиент отправляет **POST** `/api/orders` с `paymentMethod: CARD_ONLINE`.
2. Backend валидирует товары, создаёт заказ со статусом `PENDING`.
3. Backend регистрирует платёж в Alfa RBS (`register.do`) и получает `orderId` и `formUrl` банка.
4. Backend отправляет email о создании заказа.
5. В ответе клиенту возвращается заказ + поле `paymentUrl`.
6. Клиент редиректится на `paymentUrl` (форма банка), вводит карту, проходит 3DS.
7. Банк редиректит клиента обратно на `returnUrl` / `failUrl`.
8. Банк отдельно вызывает **GET** `/api/payment/alfa/callback`.
9. Backend делает обратный запрос `getOrderStatusExtended.do`, обновляет статус заказа в БД (`CONFIRMED`, `isPaid=true` при успехе).

### Что возвращает `POST /api/orders` для `CARD_ONLINE`

Обычный ответ заказа (см. [orders.md](./orders.md#3-создать-заказ)) дополняется полем `paymentUrl`. Основные поля ответа:

| Поле | Тип | Описание |
|---|---|---|
| `id` | string (uuid) | Внутренний ID заказа |
| `orderNumber` | string | Номер заказа (`SALIYYYMMDDXXXXX`) |
| `status` | string | Статус заказа, для онлайн-оплаты — `PENDING` |
| `isPaid` | boolean | Признак оплаты (для нового заказа `false`) |
| `paymentId` | string | ID платежа |
| `paymentMethod` | string | Метод оплаты, здесь `CARD_ONLINE` |
| `total` | number | Сумма к оплате |
| `paymentUrl` | string | URL формы оплаты банка для редиректа |

Действия фронта после получения ответа:

1. Если `paymentMethod === 'CARD_ONLINE'` и есть `paymentUrl` → выполнить редирект на `paymentUrl`.
2. Для остальных методов (`CARD_MANUAL` и т.п.) → показать страницу «Заказ оформлен».

### Статусы заказа при оплате через Альфа

| Статус | Что значит |
|---|---|
| `PENDING` | Заказ создан, ждёт оплаты |
| `PAYMENT_FAILED` | Платёж отклонён / регистрация в банке не удалась |
| `CONFIRMED` + `isPaid: true` | Деньги списаны, заказ подтверждён |
| `CANCELLED` | Авторизация отменена |
| `REFUNDED` | Возврат выполнен |

---

## Endpoints

### 1. Callback от Альфа-Банка

**GET** `/api/payment/alfa/callback`

Банк вызывает этот URL после изменения статуса платежа.

Query-параметры:

| Параметр | Тип | Описание |
|---|---|---|
| `mdOrder` | string | ID платежа на стороне банка |
| `orderNumber` | string | Наш номер заказа |
| `operation` | string | Тип операции: `deposited` / `approved` / `reversed` / `refunded` / `declinedByTimeout` |
| `status` | string | `1` — ок, `0` — ошибка |
| `checksum` | string | Подпись (не проверяется, см. «Безопасность») |

Поведение backend'а:

- Дёргает `getOrderStatusExtended.do` у Альфы, чтобы достоверно узнать статус.
- Обновляет `status` и `isPaid` заказа в БД.
- Отвечает `200 OK` (тело `OK`).

URL нужно прописать в личном кабинете Альфы как адрес уведомлений об изменении статуса.

---

### 2. Ручная синхронизация статуса (Альфа)

**POST** `/api/payment/alfa/check-status`

Если callback не пришёл (сеть, timeout банка), можно подтянуть статус вручную. Одновременно обновляет запись заказа в БД.

Тело запроса:

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `orderNumber` | string | да | Номер заказа |

Ответ:

| Поле | Тип | Описание |
|---|---|---|
| `orderNumber` | string | Номер заказа |
| `orderStatus` | number | Код статуса Альфы из `getOrderStatusExtended.do` |
| `status` | string | Наш внутренний статус |

---

## Маппинг статусов Альфа

`orderStatus` из `getOrderStatusExtended.do`:

| Код | Смысл Альфы | Наш внутренний статус |
|-----|---------------------------------|-----------------------|
| `0` | Заказ зарегистрирован, не оплачен | `PENDING` |
| `1` | Предавторизована | `PENDING` |
| `2` | Авторизована (списано) | `PAID` → `CONFIRMED` |
| `3` | Авторизация отменена | `CANCELED` → `CANCELLED` |
| `4` | Возврат | `REFUNDED` |
| `5` | Инициирована через ACS | `PENDING` |
| `6` | Отклонена | `FAILED` → `PAYMENT_FAILED` |

---

## Настройка

### Env-переменные (Альфа)

- `ALFA_BASE_URL` — базовый URL шлюза. Тест (UAT): `https://alfa.rbsuat.com`; прод: `https://pay.alfabank.ru`.
- `ALFA_API_USERNAME` — логин API-пользователя.
- `ALFA_API_PASSWORD` — пароль API-пользователя.
- `FRONTEND_URL` — для формирования `returnUrl` / `failUrl`.

Логин и пароль Альфы хранятся только в `.env`, не коммитятся.

### URL возврата клиента после оплаты

Формируются автоматически:

- `returnUrl`: `${FRONTEND_URL}/order/{orderNumber}?payment=success`
- `failUrl`: `${FRONTEND_URL}/order/{orderNumber}?payment=fail`

Фронт на странице `order/:orderNumber` читает query-параметр `payment`:

- `success` → показать «Оплата прошла», при необходимости вызвать **POST** `/api/payment/alfa/check-status` для актуализации статуса.
- `fail` → «Оплата не прошла, попробуйте ещё раз» + ссылка на повтор заказа.

---

## Тестовые карты Альфы (UAT)

| Номер карты | Результат |
|---------------------|-----------------------|
| `4111 1111 1111 1111` | Успешная оплата |
| `5555 5555 5555 4444` | Успешная оплата (MC) |
| `4000 0000 0000 0002` | Отказ банка |

- Срок: любая будущая дата.
- CVC/CVV: любые 3 цифры.
- 3DS пароль: `12345678` (если запрашивается).

Актуальный набор карт — в документации Альфы: <https://pay.alfabank.ru/ecommerce/instructions/merchantManual/pages/index/testCards.html>

---

## Безопасность

- Подпись callback (параметр `checksum`) **не проверяется** — для этого нужен отдельный секретный ключ, который выдают не все тарифы. Вместо проверки подписи мы делаем обратный запрос `getOrderStatusExtended.do` и доверяем только ответу банка.
- `userName` / `password` от Альфы — только в `.env`, не коммитятся.
- Сумма берётся из БД (с учётом валидации товаров/промокодов/доставки) — клиент не может подсунуть свою цену.
- Номер заказа (`orderNumber`) уникален за день (`SALIYYYMMDDXXXXX`).

---

## Известные ограничения и TODO

- Повторная регистрация платежа с тем же `orderNumber` — Альфа вернёт ошибку. На стороне фронта: если оплата не прошла, создаём новый заказ.
- Подпись callback не проверяется (см. «Безопасность»).
- Возвраты (`refund.do`) — не реализованы, добавить при необходимости.
- Reversal (`reverse.do`) для отмены авторизации — не реализован.
- Email о подтверждении оплаты (когда `isPaid` меняется на `true`) — сейчас отправляется только email о создании заказа.

---

## Яндекс Пэй

### Endpoint'ы платёжной системы

- **Sandbox:** `https://sandbox.pay.yandex.ru/api/merchant`
- **Prod:** `https://pay.yandex.ru/api/merchant`

### Что отправляем при регистрации заказа

Запрос **POST** `{base}/v1/orders` с заголовком авторизации `Api-Key {API_KEY}`. В теле передаются:

- `orderId` — наш `orderNumber`.
- `currencyCode` — буквенный код валюты (`"RUB"`).
- `merchantId` — идентификатор мерчанта.
- `orderAmount` — итоговая сумма строкой с двумя знаками (например `"8495.00"`).
- `cart.items[]` — позиции: `productId`, `title`, `quantity.count` (строка), `unitPrice`, `total`.
- `cart.total.amount` — сумма корзины.
- `redirectUrls` — `onSuccess` / `onError` / `onAbort`, ведут на `${FRONTEND_URL}/order/{orderNumber}?payment=success|fail`.
- `availablePaymentMethods` — `CARD`, `SPLIT`, `SBP`.

Особенности формата: суммы — строки с двумя знаками; валюта — буквенная; `quantity.count` — тоже строка.

Ответ содержит `paymentUrl` (уходит клиенту для редиректа) и внутренний `orderId` Яндекса. Наш `orderNumber` сохраняем в `order.paymentId`.

---

### Endpoints в backend'е

#### Webhook от Яндекс Пэй

**POST** `/api/payment/yandex/webhook`

Яндекс шлёт тело `application/octet-stream` с **JWT-токеном** (ES256) внутри. Backend декодирует payload (без проверки подписи) и для надёжности pull-ом подтверждает статус через `GET /v1/orders/{orderId}`. Подход аналогичен Альфе.

События в payload:

| Событие | Описание |
|---|---|
| `ORDER_STATUS_UPDATED` | Изменился статус заказа |
| `OPERATION_STATUS_UPDATED` | Изменился статус операции (списание/возврат/отмена) |

Настройка в кабинете Яндекса: добавить Callback URL `https://saliyclothes.com/api/payment/yandex/webhook`. Backend всегда отвечает `200 OK` с телом `{ status: "success" }`, иначе Яндекс будет ретраить с экспоненциальным бэкоффом в течение 24 часов.

#### Ручная синхронизация статуса (Яндекс)

**POST** `/api/payment/yandex/check-status`

Тело запроса:

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `orderNumber` | string | да | Номер заказа |

Ответ:

| Поле | Тип | Описание |
|---|---|---|
| `orderNumber` | string | Номер заказа |
| `yandexStatus` | string | Статус заказа на стороне Яндекс Пэй |
| `status` | string | Наш внутренний статус |

---

### Маппинг статусов Яндекс Пэй

| Яндекс `order.status` | Наш статус |
|------------------------|--------------------------|
| `NEW` | `PENDING` |
| `AUTHORIZED` | `PENDING` (предавторизация) |
| `CAPTURED` | `PAID` → `CONFIRMED` |
| `VOIDED` | `CANCELED` → `CANCELLED` |
| `REFUNDED` | `REFUNDED` |
| `PARTIALLY_REFUNDED` | `REFUNDED` |
| `FAILED` | `FAILED` → `PAYMENT_FAILED` |

---

### Настройка `.env` (Яндекс)

- `YANDEX_PAY_SANDBOX` — `true` для теста, `false` для прода.
- `YANDEX_PAY_MERCHANT_ID` — идентификатор мерчанта.
- `YANDEX_PAY_API_KEY` — ключ Merchant API.

В sandbox `API_KEY` совпадает с `MERCHANT_ID`. В проде это разные значения, ключ Merchant API получаешь в кабинете Яндекс Пэй.

---

### Что НЕ реализовано

- **Проверка подписи JWT (ES256)** — нужен публичный ключ Яндекса. Сейчас доверяем pull-запросу к API.
- Возвраты (`POST /v1/operations/.../refund`).
- Двухстадийные платежи (предавторизация + capture). Все платежи one-step.
