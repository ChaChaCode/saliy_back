# API админ-панели: Заказы

**Базовый URL:** `/api/admin/orders`

**Авторизация:** все эндпоинты требуют авторизации администратора (`AdminGuard`). Запросы авторизуются через httpOnly cookie `adminToken`, которую браузер отправляет автоматически (заголовок `Authorization` также принимается для обратной совместимости).

---

## 1. Статистика заказов

**GET** `/api/admin/orders/stats`

Общая статистика по заказам для дашборда.

| Поле ответа | Описание |
|-------------|----------|
| `totalOrders` | Всего заказов |
| `paidOrders` | Оплаченных заказов |
| `todayOrders` | Заказов за сегодня |
| `totalRevenue` | Общая выручка (оплаченные, без отменённых) |
| `byStatus` | Распределение заказов по статусам |

---

## 2. Список заказов

**GET** `/api/admin/orders`

Список всех заказов с фильтрами и пагинацией.

| Параметр | Тип | Описание |
|----------|-----|----------|
| `status` | OrderStatus | Фильтр по статусу (PENDING, CONFIRMED, etc.) |
| `isPaid` | boolean | Только оплаченные / неоплаченные |
| `search` | string | Поиск по номеру заказа, имени, email, телефону |
| `dateFrom` | ISO date | Заказы от даты |
| `dateTo` | ISO date | Заказы до даты |
| `page` | number | Номер страницы (default 1) |
| `limit` | number | Размер страницы (default 20) |

Ответ: объект с полями `orders` (массив заказов с `items` и `promoCode`) и `pagination` (`page`, `limit`, `total`, `totalPages`). CDEK-поля (см. ниже) присутствуют в каждом заказе.

---

## 3. Получить заказ по номеру

**GET** `/api/admin/orders/:orderNumber`

Детальная информация о заказе, включая данные пользователя (если был авторизован), состав (`items`) и промокод.

### CDEK-поля (где заказ сейчас)

| Поле | Описание |
|------|----------|
| `cdekNumber` | Номер накладной CDEK (для отображения клиенту) |
| `cdekUuid` | Внутренний идентификатор CDEK |
| `cdekStatus` | Текущий код статуса из CDEK (см. маппинг ниже) |
| `cdekStatusName` | Человекочитаемое название статуса |
| `cdekStatusDate` | Когда статус получен (из webhook или ручного refresh) |
| `cdekTrackingUrl` | Готовая ссылка для клиента, `null` если накладная ещё не выписана |
| `cancelReason` | Причина отмены/неоплаты заказа, `null` если заказ нормальный |

Поле `cancelReason` заполняется автоматически, когда заказ становится отменённым или неоплаченным, и показывает почему: «Не оплачен в течение N мин — автоотмена» (клиент не успел оплатить), «Платёж отклонён платёжной системой» / «Оплата отменена / истёк срок платёжной ссылки» (отказ от Точки/Яндекса), «Ошибка регистрации платежа …» (не удалось создать ссылку), «Отменён администратором: …» (ручная отмена). При успешной оплате причина очищается.

---

## 4. Обновить поля заказа

**PATCH** `/api/admin/orders/:orderNumber`

Обновление произвольных полей заказа (контакты клиента, адрес, доставка, комментарий). Все поля опциональны — передавайте только те, что нужно изменить. Этот эндпоинт **не** меняет `status` и `total`.

### Доступные поля

Клиент:

| Поле | Тип | Описание |
|------|-----|----------|
| `firstName` | string | Имя |
| `lastName` | string | Фамилия |
| `phone` | string | Телефон |
| `email` | string | Email |
| `socialContact` | string | Контакт в соцсети/мессенджере |
| `comment` | string | Комментарий к заказу |

Адрес:

| Поле | Тип | Описание |
|------|-----|----------|
| `countryName` | string | Страна |
| `regionName` | string | Регион |
| `cityName` | string | Город |
| `cdekCityCode` | number | Код города CDEK |
| `street` | string | Улица |
| `apartment` | string | Квартира |
| `postalCode` | string | Индекс |
| `pickupPoint` | string | Код ПВЗ |

При самовывозе CDEK (`deliveryType=CDEK_PICKUP`) фронт присылает только код ПВЗ (`pickupPoint`). Backend автоматически подтягивает из CDEK по этому коду адрес пункта и заполняет `cityName`, `regionName`, `postalCode` и `street` (полный адрес ПВЗ), если они пришли пустыми. Так в админке виден читаемый адрес выдачи, а не только код вида `CHEL47`.

Доставка и оплата:

| Поле | Тип | Описание |
|------|-----|----------|
| `deliveryType` | enum | CDEK_PICKUP / STANDARD |
| `paymentMethod` | enum | SBP_TOCHKA / YANDEX_PAY (активны); CARD_ONLINE / CARD_MANUAL / CRYPTO / PAYPAL (прочие) |
| `deliveryPrice` | number | Цена доставки (>= 0) |
| `deliveryTotal` | number | Итог по доставке (>= 0) |
| `isPaid` | boolean | Признак оплаты |
| `paymentId` | string | ID платежа |

Ответ: обновлённый объект заказа. Ошибки: `404` — заказ не найден.

### Автосинхронизация с CDEK

Если у заказа уже есть `cdekUuid` (накладная создана в CDEK) и через PATCH меняются релевантные для CDEK поля — изменения автоматически пушатся в CDEK (`PATCH /v2/orders/{uuid}`).

| Поле в нашем PATCH | Что меняется в CDEK |
|--------------------|---------------------|
| `firstName`, `lastName` | `recipient.name` (склеиваются) |
| `phone` | `recipient.phones[].number` |
| `email` | `recipient.email` |
| `comment` | `comment` накладной |
| `pickupPoint` (при `deliveryType=CDEK_PICKUP`) | `delivery_point` (код ПВЗ) |
| `cdekCityCode`, `street`, `apartment` (при `deliveryType=CDEK_COURIER`) | `to_location` (город/адрес) |

CDEK позволяет менять данные только пока посылка не уехала со склада отправителя. Если статус уже `TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY` или дальше — CDEK откажет. В этом случае запись в нашей БД всё равно обновится (`200 OK`), а в ответе появится поле `cdekSyncError` с текстом ошибки от CDEK. Если `cdekUuid` отсутствует (накладная ещё не создана) — синхронизации нет.

---

## 5. Изменить статус заказа

**PATCH** `/api/admin/orders/:orderNumber/status`

Обновить статус заказа. Нельзя менять статус отменённых заказов.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `status` | OrderStatus | Да | Новый статус |

Доступные статусы: `PENDING`, `PAYMENT_FAILED`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` (для отмены используйте отдельный эндпоинт), `REFUNDED`.

Ответ: обновлённый объект заказа. Ошибки: `404` — заказ не найден, `400` — попытка изменить статус отменённого заказа.

---

## 6. Отменить заказ

**POST** `/api/admin/orders/:orderNumber/cancel`

Отменяет заказ и возвращает остатки на склад (товары снова доступны). Также уменьшает счётчик `salesCount` у товаров. Всё выполняется в транзакции.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `reason` | string | Нет | Причина — пишется только в логи |

Ответ: обновлённый заказ со `status: CANCELLED`. Ошибки: `404` — заказ не найден, `400` — заказ уже отменён, `400` — нельзя отменить доставленный заказ.

---

## 7. Оформить возврат

**POST** `/api/admin/orders/:orderNumber/refund`

Переводит заказ в статус `REFUNDED`. Причина дописывается в поле `comment` заказа с префиксом `[ВОЗВРАТ]:`. Склад не трогается.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `reason` | string | Да | Причина возврата |

Ошибки: `400` — нельзя вернуть неоплаченный заказ, `400` — заказ уже возвращён.

Отличие от `cancel`: `cancel` возвращает остатки на склад (для неотправленных заказов); `refund` — для уже оплаченных/доставленных заказов.

---

## 8. Обновить CDEK-информацию

**PATCH** `/api/admin/orders/:orderNumber/cdek`

Ручное обновление CDEK-данных заказа (например, после создания накладной в панели CDEK). Все поля опциональны.

| Поле | Тип | Описание |
|------|-----|----------|
| `cdekNumber` | string | Номер накладной |
| `cdekUuid` | string | UUID заказа в CDEK |
| `cdekStatus` | string | Код статуса |
| `cdekStatusName` | string | Название статуса |

При передаче `cdekStatus` автоматически обновляется `cdekStatusDate`.

---

## 8.1. Подтянуть актуальный статус из CDEK

**POST** `/api/admin/orders/:orderNumber/cdek/refresh`

Когда webhook потерялся / не настроен — админ запрашивает у CDEK статус напрямую по `cdekUuid` (или `cdekNumber`) и сохраняет в БД.

Что делает: берёт идентификатор заказа, запрашивает `GET /orders/{identifier}` в CDEK, берёт последний статус из `entity.statuses`, обновляет `cdekStatus`, `cdekStatusName`, `cdekStatusDate` и `status` (если CDEK-статус маппится в продвижение вперёд). Не понижает статус заказа.

Ответ содержит: `orderNumber`, `cdekStatus`, `cdekStatusName`, `cdekStatusDate`, `status`, `trackingUrl`.

Ошибки:

| Код | Описание |
|-----|----------|
| 404 | Заказ N не найден |
| 404 | У заказа N нет CDEK-идентификаторов (ещё не создана накладная) |

---

## 8.2. Webhook от CDEK

**POST** `/api/delivery/webhook` — **не под AdminGuard**, принимает уведомления от CDEK напрямую.

CDEK присылает уведомление с типом `ORDER_STATUS`, идентификатором заказа (`uuid`) и атрибутами (`cdek_number`, `code`, `name`, `date_time`).

Поведение бэка: ищет заказ по `cdekUuid` или `cdekNumber`; обновляет `cdekStatus`/`cdekStatusName`/`cdekStatusDate`; маппит статус CDEK на `OrderStatus` и меняет, если это продвижение вперёд и заказ не отменён/не возвращён.

Настройка webhook в личном кабинете CDEK: URL `https://saliyclothes.com/api/delivery/webhook`, тип события `ORDER_STATUS`, метод `POST`.

### Маппинг CDEK → OrderStatus

| CDEK код | Описание | Наш статус |
|----------|----------|-----------|
| `CREATED`, `ACCEPTED` | Заказ создан/принят | `CONFIRMED` |
| `RECEIVED_AT_SHIPMENT_WAREHOUSE`, `READY_FOR_SHIPMENT_IN_SENDER_CITY` | На складе | `PROCESSING` |
| `TAKEN_BY_TRANSPORTER_*`, `SENT_TO_*`, `ACCEPTED_IN_TRANSIT_CITY`, `ACCEPTED_AT_RECIPIENT_CITY_WAREHOUSE`, `ACCEPTED_AT_PICK_UP_POINT`, `READY_TO_BE_HANDED_OVER`, `TAKEN_BY_COURIER` | В пути / прибыл в ПВЗ / у курьера | `SHIPPED` |
| `RECEIVED`, `DELIVERED` | Вручён | `DELIVERED` |
| `NOT_DELIVERED` | Не доставлен | `CANCELLED` |
| `RETURNED`, `RETURNED_TO_SENDER` | Возврат | `REFUNDED` |

---

## 9. Отправить письмо клиенту

**POST** `/api/admin/orders/:orderNumber/send-email`

Отправляет произвольное email клиенту по данному заказу (например, «ваш заказ задерживается»). Письмо отправляется в шаблоне с обращением к клиенту и номером заказа.

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `subject` | string | Да | Тема письма |
| `message` | string | Да | Текст письма |

Ответ: `success: true` и адрес получателя (`sentTo`).

---

## 10. Экспорт заказов в CSV

**GET** `/api/admin/orders/export.csv`

Принимает те же query-фильтры, что `GET /api/admin/orders` (status, isPaid, search, dateFrom, dateTo). Возвращает CSV-файл (UTF-8 с BOM, разделитель `;`) со столбцами: Номер заказа; Дата; Клиент; Email; Телефон; Статус; Оплачен; Товаров; Сумма; Валюта; Доставка; Промокод. Максимум 10000 строк за один запрос.

---

## OrderStatus — жизненный цикл заказа

PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → (REFUNDED). Из PENDING возможен переход в PAYMENT_FAILED. Любой статус (кроме DELIVERED) может перейти в CANCELLED.
