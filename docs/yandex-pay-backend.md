# Яндекс Пэй / Сплит: что изменено в бэкенде

Дата: 14 ноября 2026. Изменения работают на сервере
(`/home/deploy/apps/saliy_back`, процесс `saliy_back` в pm2). 15 ноября код
перенесён в git вместе с доработкой причин отказа банка (раздел 10), исходники
в git совпадают с сервером.

Яндекс Пэй вернулся вторым способом оплаты рядом с Т-Банком (`YANDEX_PAY`).
Старый сервис Яндекса удалили при переходе на Т-Банк; это новая реализация по
текущей документации Merchant API, со своим мерчантом.

## 1. Что поменялось в API

| Запрос | Изменение |
| --- | --- |
| `GET /api/orders/delivery-options` | `paymentMethods: ["CARD_ONLINE", "YANDEX_PAY"]`. `YANDEX_PAY` есть, только когда заданы мерчант, ключ и хотя бы один способ из `CARD`, `SPLIT` |
| `POST /api/orders/calculate`, `POST /api/orders` | `paymentMethod` принимает `CARD_ONLINE` и `YANDEX_PAY`. `POST /api/orders` без настроек Яндекса — `400 «Оплата через Яндекс Пэй сейчас недоступна»` |
| `POST /api/orders` с `YANDEX_PAY` | `paymentUrl` ведёт на `https://pay.ya.ru/l/…`. В `order.paymentId` записывается `orderNumber` — это `orderId` заказа в Яндексе |
| `POST /api/payment/yandex/v1/webhook` | Новый. Уведомления Яндекса |

Т-Банк не менялся. Возврат через админку (`refundPaidOrder`) по-прежнему только
через Т-Банк: для заказов Яндекса он требует `manual: true`.

## 2. Файлы

Новые:

- `src/payment/yandex-pay.service.ts` — создание заказа (`POST /v1/orders`),
  статус (`GET /v1/orders/{id}`), маппинг статусов, проверка JWT уведомлений.
- `src/payment/yandex-pay.cart.ts` — корзина для Яндекса.
- `src/payment/raw-body.util.ts` — чтение сырого тела запроса.
- `src/payment/yandex-pay.service.spec.ts`, `src/payment/yandex-pay.cart.spec.ts`.

Изменённые:

- `src/payment/payment.controller.ts` — маршрут webhook.
- `src/payment/payment.module.ts` — `YandexPayService` в providers и exports.
- `src/orders/orders.service.ts` — регистрация платежа в Яндексе в
  `createOrder`, `confirmYandexByApi`, cron `poll-yandex-payments`.
  `YandexPayService` добавлен **последним** параметром конструктора.
- `src/orders/orders.controller.ts` — список способов оплаты.
- `src/orders/orders.dto.ts` — `@IsIn([CARD_ONLINE, YANDEX_PAY])`.
- `src/common/email/email.service.ts` — подпись в письме:
  `YANDEX_PAY: 'ЯНДЕКС ПЭЙ / СПЛИТ'`.

## 3. Создание платежа

`createOrder` для `YANDEX_PAY` вызывает `yandexPayService.registerOrder`:

- `orderId` = наш `orderNumber` (он же ключ идемпотентности у Яндекса).
- `availablePaymentMethods` из `YANDEX_PAY_METHODS` (сейчас `CARD,SPLIT`).
- `redirectUrls`: `onSuccess` → `/order/{n}?payment=success`, `onError` и
  `onAbort` → `?payment=fail`.
- `ttl` = `ORDER_PAYMENT_LINK_TTL_MIN` × 60, в пределах 120…604800 с.
- `orderSource: "WEBSITE"`, `billingPhone` — телефон заказа, если он похож на
  `+7XXXXXXXXXX` (помогает одобрению Сплита).
- Авторизация `Authorization: Api-Key <YANDEX_PAY_API_KEY>`.

Корзина (`buildYandexCart`). Яндекс отклоняет заказ, если сумма позиций не
равна `cart.total` или `total / quantity.count` даёт больше двух знаков после
запятой. Поэтому:

- `productId` = `{productId}-{size}`, `title` = «Название, размер», `total` —
  сумма строки после скидок товара.
- Скидка по промокоду раскладывается по строкам в копейках пропорционально.
- Строка, которая после этого не делится на количество, режется на две
  (`…` на N−1 шт. и `…:1` на 1 шт.).
- Доставка — отдельная позиция `delivery`, если она не 0.
- Если итог корзины не равен `total` заказа в копейках — исключение, и заказ
  уходит в `PAYMENT_FAILED` существующим путём.

Данные для чеков (`receipt`, НДС) **не передаются**: фискализация в кабинете
Яндекса не включена. Если её включат — нужно добавить `receipt` в позиции и
`fiscalContact`.

## 4. Подтверждение оплаты

Источник правды — только `GET /v1/orders/{orderNumber}`. И webhook, и опрос
вызывают `ordersService.confirmYandexByApi(orderNumber)`:

- Заказа нет или он не `YANDEX_PAY` — warning в лог и выход (чтобы Яндекс не
  повторял уведомление сутки).
- `paymentStatus` → внутренний: `CAPTURED` → `PAID`, `FAILED` → `FAILED`,
  `VOIDED` → `CANCELED`, `REFUNDED` → `REFUNDED`. `PENDING`, `AUTHORIZED`,
  `CONFIRMED`, `PARTIALLY_REFUNDED` — ничего не меняют: платёж одностадийный,
  деньги получены только в `CAPTURED`.
- При `PAID` сумма `orderAmount` сверяется с `order.total` в копейках; не
  совпала — `400`.
- Дальше существующий `updatePaymentStatus` (чек, корзина, накладная СДЭК,
  возврат резерва при отказе).

Опрос: cron `poll-yandex-payments` раз в минуту по заказам `PENDING`,
`isPaid: false`, `paymentMethod: YANDEX_PAY`, `paymentId` не пустой.
Выключается `YANDEX_POLLING_ENABLED=false`. Автоотмена через
`ORDER_PENDING_TIMEOUT_MIN` (25 мин) уже включала `YANDEX_PAY`.

## 5. Webhook

- Маршрут `POST /api/payment/yandex/v1/webhook`. Яндекс **сам дописывает**
  `/v1/webhook` к Callback URL, поэтому в кабинете стоит
  `https://saliystudio.com/api/payment/yandex`. Старый маршрут
  `/api/payment/yandex/webhook` из прежней реализации Яндекс не вызывал бы.
- Тело — JWT ES256, `Content-Type: application/octet-stream`. Глобальный
  bodyParser выключен (`main.ts`), а парсеры JSON и форм из модуля Better Auth
  это тело не трогают, поэтому `readRawBody` читает поток сам (лимит 16 КБ).
- Проверка `verifyWebhookToken`: `alg: ES256`, ключ по `kid` из
  `https://pay.yandex.ru/api/jwks` (sandbox — `https://sandbox.pay.yandex.ru/api/jwks`),
  подпись (`ieee-p1363`), `exp`/`iat` с допуском 300 с, `merchantId` =
  `YANDEX_PAY_MERCHANT_ID`. Ключи кешируются на час; неизвестный `kid`
  перечитывает JWKS не чаще раза в минуту.
- Ответы: принято — `200 {"status":"success"}`; токен не прошёл —
  `400 {"status":"fail","reasonCode":"UNAUTHORIZED"}`; ошибка API Яндекса или
  несовпадение суммы — `400`/`502`, Яндекс повторит.

## 6. Переменные окружения

В `.env`:

| Переменная | Значение |
| --- | --- |
| `YANDEX_PAY_MERCHANT_ID` | `7c7fd2f4-b951-4f39-a0e1-b355c4643354` (новый мерчант; старый `34eb…` больше не используется) |
| `YANDEX_PAY_API_KEY` | ключ Merchant API нового мерчанта (в `.env`, в репозиторий не класть) |
| `YANDEX_PAY_METHODS` | `CARD,SPLIT`. Допустимы только `CARD` и `SPLIT`; по умолчанию оба |
| `YANDEX_PAY_SANDBOX` | `false`. Теперь sandbox включается только явным `true` |
| `YANDEX_POLLING_ENABLED` | `true` |

`YANDEX_PAY_WEBHOOK_SECRET` новой реализацией не используется.

**Ловушка с pm2.** Процесс `saliy_back` хранит окружение со своего первого
запуска, а `ConfigModule.forRoot` и `dotenv.config()` в `prisma.service.ts`
не перезаписывают уже заданные переменные. После правки `.env` старые значения
Яндекса оставались в процессе, и два заказа (`SALIY26111400062`, `…063`) ушли
в старый кабинет; они отменились автоматически. Исправлено перезапуском процесса, которому новые значения переменных Яндекса переданы прямо в окружении, с перечитыванием окружения и сохранением списка процессов pm2.

Правка `.env` без такого перезапуска на процесс не действует. Лучше один раз
перевести конфиг на `override: true` или перезапустить процесс через
`pm2 delete` + `pm2 start ecosystem.config.js`, чтобы `.env` снова был
единственным источником.

## 7. Как выложено

- Сборка — локально из копии исходников сервера. Перед выкладкой хэши всех
  файлов `dist` сравнены с серверными: совпали все, кроме 9 изменённых. На
  сервер скопированы только эти 9 `.js` и исходники из списка выше; `.js.map`
  и `.d.ts` изменённых файлов остались старыми.
- Резервная копия заменённых файлов и `.env`:
  `/home/deploy/backups/yandex-pay-20261114-184130`. Откат — вернуть файлы из
  неё и перезапустить процесс со старыми значениями переменных (см. раздел 6).
- `tsc -p tsconfig.build.json` — без ошибок. `jest src/payment` — 14 тестов
  прошли.
- `src/orders/preorders.spec.ts` на сервере был устаревшей копией; в git он
  актуальный и проходит. Все 87 тестов проекта проходят.
- 15 ноября исходники сервера сверены с git файл за файлом: после переноса
  этих изменений они совпадают (кроме устаревших тестов на сервере).

## 8. Проверено на проде

- Ключ: `GET /v1/orders/<несуществующий>` → `404 ORDER_NOT_FOUND_ERROR`
  (авторизация принята).
- `TEST2611141852`, 1 ₽: оплачено картой, подтверждено опросом.
- `TEST2611141858`, 1 ₽: подтверждено webhook за ту же секунду
  (`YandexPay/1.0`, ответ 200).
- Поддельный JWT → `400 UNAUTHORIZED`.

Тестовые заказы созданы скриптом `/home/deploy/build/yandex-test-order.js`:
доставка `STANDARD` (без накладной СДЭК), без товарных позиций, email
`test-yandex-pay@example.com`. Деньги по ним возвращаются в кабинете Яндекса;
после этого заказы получат `REFUNDED` через webhook.

## 9. Не сделано

- Фискализация (`receipt` в позициях) — см. раздел 3.
- Возврат через API Яндекса из админки. Сейчас: возврат в кабинете Яндекса →
  `REFUNDED` приходит сам; частичный возврат (`PARTIALLY_REFUNDED`) бэкенд не
  отмечает — его нужно записать вручную (`manual: true`).
- Сплит не проверен вживую: на 1 ₽ он недоступен.
- Двухстадийные платежи и Сплит «при получении» (`isPrepayment`) не включались.

## 10. Причина отказа банка (добавлено на сервере 14 ноября, 23:22)

Не входило в исходный patch, перенесено в git 15 ноября.

- Т-Банк: из уведомления и GetState берётся текст и код отказа, например
  «Оплата иностранной картой недоступна (код 77)», и дописывается в
  `cancelReason` заказа.
- GetState отклонённой попытки отвечает `Success: true` с кодом отказа — это
  состояние платежа, а не сбой запроса. Раньше такой ответ считался ошибкой, и
  причина до заказа не доходила.
- Если попытка отклонена, но покупатель ещё может оплатить снова, заказ остаётся
  в ожидании с пометкой «Попытка оплаты отклонена: …». Если заказ уже отменён по
  таймауту, причина дописывается к существующей.
- Яндекс: в статус заказа добавлена причина (`reason`, `reasonCode`) из API.
- Файлы: `src/payment/tbank-pay.service.ts` (`describeDecline`),
  `src/payment/payment.controller.ts`, `src/orders/orders.service.ts`,
  `src/payment/yandex-pay.service.ts`, тесты в `tbank-pay.service.spec.ts`.
