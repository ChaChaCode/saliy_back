# API Промокодов (Admin)

Административный API для управления промокодами. Все эндпоинты требуют авторизации через Telegram.

**Базовый URL:** `/api/admin/promo-codes`

**Требуется:** `AdminGuard` (JWT токен администратора)

---

## Содержание

- [Типы данных](#типы-данных)
- [Эндпоинты](#эндпоинты)
  - [POST /api/admin/promo-codes](#post-apiadminpromo-codes) - Создать промокод
  - [GET /api/admin/promo-codes](#get-apiadminpromo-codes) - Получить все промокоды
  - [GET /api/admin/promo-codes/:id](#get-apiadminpromo-codesid) - Получить промокод по ID
  - [PUT /api/admin/promo-codes/:id](#put-apiadminpromo-codesid) - Обновить промокод
  - [DELETE /api/admin/promo-codes/:id](#delete-apiadminpromo-codesid) - Удалить промокод
  - [POST /api/admin/promo-codes/:id/deactivate](#post-apiadminpromo-codesiddeactivate) - Деактивировать промокод
  - [GET /api/admin/promo-codes/:id/stats](#get-apiadminpromo-codesidstats) - Статистика использований
- [UX Рекомендации для фронтенда](#ux-рекомендации-для-фронтенда)
- [Коды ошибок](#коды-ошибок)

---

## Типы данных

### PromoType (Тип промокода)

| Значение        | Описание                          |
|-----------------|-----------------------------------|
| `PERCENTAGE`    | Процентная скидка (10% = value: 10) |
| `FIXED`         | Фиксированная скидка в рублях (500₽ = value: 500) |
| `FREE_DELIVERY` | Бесплатная доставка               |

### PromoAppliesTo (К чему применяется)

| Значение  | Описание                              |
|-----------|---------------------------------------|
| `ALL`     | Ко всем товарам                       |
| `PRODUCT` | К конкретным товарам (по ID)          |

### Объект PromoCode

| Поле                 | Тип        | Описание                                                |
|----------------------|------------|--------------------------------------------------------|
| `id`                 | `number`   | Уникальный идентификатор промокода                      |
| `code`               | `string`   | Код промокода (хранится в верхнем регистре)             |
| `type`               | `string`   | Тип промокода (`PERCENTAGE`, `FIXED`, `FREE_DELIVERY`)  |
| `value`              | `number`   | Значение скидки (процент или сумма в RUB)              |
| `appliesTo`          | `string`   | К чему применяется промокод                             |
| `allowedUserIds`     | `string[]` | Массив UUID пользователей (пустой = для всех)          |
| `requiresAuth`       | `boolean`  | Требуется авторизация (только для зарегистрированных)   |
| `maxUses`            | `number \| null` | Общий лимит использований (`null` = безлимит)      |
| `maxUsesPerUser`     | `number \| null` | Лимит на одного пользователя (`null` = безлимит)   |
| `usedCount`          | `number`   | Текущее количество использований                        |
| `maxItems`           | `number \| null` | Максимум товаров к которым применяется скидка (null = все) |
| `minOrderAmount`     | `number \| null` | Минимальная сумма заказа для активации          |
| `specificProductIds` | `number[]` | Массив ID товаров, к которым применяется промокод       |
| `excludedProductIds` | `number[]` | Массив ID товаров, исключённых из скидки                |
| `excludeNewItems`    | `boolean`  | Не применять к товарам с cardStatus=NEW (по умолчанию true) |
| `validFrom`          | `string`   | Дата начала действия (ISO 8601)                         |
| `validUntil`         | `string`   | Дата окончания действия (ISO 8601)                      |
| `isActive`           | `boolean`  | Активен ли промокод                                     |
| `description`        | `string`   | Автоматически сгенерированное описание                  |
| `createdAt`          | `string`   | Дата создания                                           |
| `updatedAt`          | `string`   | Дата последнего обновления                              |
| `createdBy`          | `string`   | Кем создан (по умолчанию `admin`)                       |

---

## Эндпоинты

### POST /api/admin/promo-codes

Создание нового промокода.

> **Важно:** Можно создавать промокоды с кодами, которые ранее использовались, если предыдущие промокоды с таким кодом деактивированы, истекли или исчерпали лимит использований.

#### Тело запроса (CreatePromoCodeDto)

| Поле                 | Тип        | Обязательное | Описание                                           |
|----------------------|------------|--------------|---------------------------------------------------|
| `code`               | `string`   | Да           | Код промокода (будет сохранён в верхнем регистре) |
| `type`               | `string`   | Да           | Тип: `PERCENTAGE`, `FIXED` или `FREE_DELIVERY`    |
| `value`              | `number`   | Да           | Значение скидки (>= 0)                            |
| `appliesTo`          | `string`   | Нет          | К чему применяется. По умолчанию `ALL`            |
| `allowedUserIds`     | `string[]` | Нет          | Массив UUID пользователей (пустой = для всех)     |
| `requiresAuth`       | `boolean`  | Нет          | Требуется авторизация. По умолчанию `false`       |
| `maxUses`            | `number`   | Нет          | Общий лимит использований (>= 1, `null` = безлимит) |
| `maxUsesPerUser`     | `number`   | Нет          | Лимит на одного пользователя (>= 1, `null` = безлимит) |
| `maxItems`           | `number`   | Нет          | Макс. товаров к которым применяется (null = все)  |
| `minOrderAmount`     | `number`   | Нет          | Минимальная сумма заказа в рублях (>= 0)          |
| `excludeNewItems`    | `boolean`  | Нет          | Не применять к новинкам (по умолчанию true)       |
| `specificProductIds` | `number[]` | Нет          | ID товаров, к которым применяется                 |
| `excludedProductIds` | `number[]` | Нет          | ID товаров-исключений                             |
| `validFrom`          | `string`   | Нет          | Дата начала действия (ISO 8601)                   |
| `validUntil`         | `string`   | Нет          | Дата окончания действия (ISO 8601)                |
| `isActive`           | `boolean`  | Нет          | Активен ли промокод. По умолчанию `true`          |

#### Пример запроса - Процентная скидка на всё

```http
POST /api/admin/promo-codes
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "code": "SALE20",
  "type": "PERCENTAGE",
  "value": 20,
  "minOrderAmount": 5000,
  "validUntil": "2026-12-31T23:59:59Z"
}
```

#### Пример ответа

```json
{
  "promoCode": {
    "id": 1,
    "code": "SALE20",
    "type": "PERCENTAGE",
    "value": 20,
    "appliesTo": "ALL",
    "specificProductIds": [],
    "excludedProductIds": [],
    "allowedUserIds": [],
    "maxUses": null,
    "maxUsesPerUser": null,
    "usedCount": 0,
    "maxItems": null,
    "minOrderAmount": 5000,
    "excludeNewItems": true,
    "validFrom": null,
    "validUntil": "2026-12-31T23:59:59.000Z",
    "isActive": true,
    "description": "Скидка 20% на всё",
    "createdBy": "admin",
    "createdAt": "2026-03-30T10:30:00.000Z",
    "updatedAt": "2026-03-30T10:30:00.000Z"
  },
  "description": "Скидка 20% на всё"
}
```

#### Пример запроса - Бесплатная доставка

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "FREESHIP",
  "type": "FREE_DELIVERY",
  "value": 0,
  "minOrderAmount": 3000
}
```

> **Примечание:** Для `FREE_DELIVERY` поле `value` должно быть `0`. Промокод не даёт скидку на товары, только бесплатную доставку.

#### Пример запроса - Фиксированная скидка на конкретные товары

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "JACKET500",
  "type": "FIXED",
  "value": 500,
  "appliesTo": "PRODUCT",
  "specificProductIds": [20, 21, 22],
  "minOrderAmount": 5000
}
```

#### Пример запроса - Промокод только для зарегистрированных пользователей

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "REGISTERED10",
  "type": "PERCENTAGE",
  "value": 10,
  "requiresAuth": true,
  "minOrderAmount": 3000
}
```

> **Примечание:** Промокод с `requiresAuth: true` доступен **всем зарегистрированным** пользователям, но не гостям. Это отличается от `allowedUserIds`, где промокод доступен только конкретным пользователям.

#### Пример запроса - Персональный промокод для одного пользователя

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "VIP-USER-123",
  "type": "PERCENTAGE",
  "value": 30,
  "allowedUserIds": ["550e8400-e29b-41d4-a716-446655440000"],
  "maxUsesPerUser": 1
}
```

#### Пример запроса - Промокод для группы пользователей

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "FRIENDS25",
  "type": "PERCENTAGE",
  "value": 25,
  "allowedUserIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "maxUsesPerUser": 2
}
```

> **Примечание:** Если `allowedUserIds` пустой массив или не указан — промокод доступен всем (включая гостей). Если массив заполнен — только авторизованным пользователям с указанными UUID.

#### Пример запроса - Промокод с общим лимитом

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "LIMITED100",
  "type": "PERCENTAGE",
  "value": 15,
  "maxUses": 100,
  "maxUsesPerUser": 1
}
```

#### Пример запроса - Промокод применимый к новинкам

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "NEWITEMS15",
  "type": "PERCENTAGE",
  "value": 15,
  "excludeNewItems": false
}
```

> **Примечание:** По умолчанию `excludeNewItems=true`, что означает что промокоды типа PERCENTAGE и FIXED не применяются к товарам с `cardStatus='NEW'`. FREE_DELIVERY всегда применяется к новинкам.

#### Пример запроса - Промокод с исключениями

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "SUMMER15",
  "type": "PERCENTAGE",
  "value": 15,
  "appliesTo": "ALL",
  "excludedProductIds": [10, 11, 12]
}
```

#### Пример запроса - Скидка на N самых дорогих товаров

```http
POST /api/admin/promo-codes
Content-Type: application/json

{
  "code": "TOP2SALE",
  "type": "PERCENTAGE",
  "value": 30,
  "maxItems": 2
}
```

> **Примечание:** `maxItems` ограничивает количество товаров, к которым применяется скидка. Скидка применится к N самым дорогим товарам в корзине.

---

### GET /api/admin/promo-codes

Получение списка всех промокодов с пагинацией и фильтрацией.

#### Query параметры

| Параметр   | Тип      | По умолчанию | Описание                                    |
|------------|----------|--------------|---------------------------------------------|
| `isActive` | `string` | -            | Фильтр по активности (`true` или `false`)   |
| `type`     | `string` | -            | Фильтр по типу (`PERCENTAGE`, `FIXED`, `FREE_DELIVERY`) |
| `page`     | `string` | `1`          | Номер страницы                              |
| `limit`    | `string` | `50`         | Количество записей на странице              |

#### Пример запроса

```http
GET /api/admin/promo-codes?isActive=true&type=PERCENTAGE&page=1&limit=10
```

#### Пример ответа

```json
{
  "promoCodes": [
    {
      "id": 1,
      "code": "SALE20",
      "type": "PERCENTAGE",
      "value": 20,
      "appliesTo": "ALL",
      "allowedUserIds": [],
      "maxUses": null,
      "maxUsesPerUser": null,
      "usedCount": 5,
      "minOrderAmount": 5000,
      "excludeNewItems": true,
      "specificProductIds": [],
      "excludedProductIds": [],
      "validFrom": "2026-01-01T00:00:00.000Z",
      "validUntil": "2026-12-31T23:59:59.000Z",
      "isActive": true,
      "description": "Скидка 20% на всё",
      "createdAt": "2026-03-30T10:30:00.000Z",
      "createdBy": "admin"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### GET /api/admin/promo-codes/:id

Получение промокода по ID с последними 10 использованиями.

#### Параметры пути

| Параметр | Тип      | Описание                |
|----------|----------|------------------------|
| `id`     | `number` | ID промокода           |

#### Пример запроса

```http
GET /api/admin/promo-codes/1
```

#### Пример ответа

```json
{
  "id": 1,
  "code": "SALE20",
  "type": "PERCENTAGE",
  "value": 20,
  "appliesTo": "ALL",
  "allowedUserIds": [],
  "maxUses": null,
  "maxUsesPerUser": null,
  "usedCount": 5,
  "specificProductIds": [],
  "excludedProductIds": [],
  "excludeNewItems": true,
  "minOrderAmount": 5000,
  "validFrom": null,
  "validUntil": "2026-12-31T23:59:59.000Z",
  "isActive": true,
  "description": "Скидка 20% на всё",
  "createdAt": "2026-03-30T10:30:00.000Z",
  "updatedAt": "2026-03-30T10:30:00.000Z",
  "createdBy": "admin",
  "usages": [
    {
      "id": 1,
      "promoCodeId": 1,
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "orderId": "abc-123",
      "usedAt": "2026-03-30T12:00:00.000Z",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "firstName": "Иван",
        "lastName": "Петров"
      }
    }
  ]
}
```

#### Ошибка - Промокод не найден

```json
{
  "statusCode": 404,
  "message": "Промокод с ID 999 не найден",
  "error": "Not Found"
}
```

---

### PUT /api/admin/promo-codes/:id

Обновление существующего промокода.

#### Параметры пути

| Параметр | Тип      | Описание      |
|----------|----------|--------------|
| `id`     | `number` | ID промокода |

#### Тело запроса (UpdatePromoCodeDto)

Все поля опциональны. Передавайте только те поля, которые нужно обновить.

| Поле                 | Тип        | Описание                                          |
|----------------------|------------|--------------------------------------------------|
| `code`               | `string`   | Новый код промокода                               |
| `type`               | `string`   | Тип: `PERCENTAGE`, `FIXED` или `FREE_DELIVERY`    |
| `value`              | `number`   | Значение скидки (>= 0)                            |
| `appliesTo`          | `string`   | К чему применяется                                |
| `allowedUserIds`     | `string[]` | Массив UUID пользователей (пустой = для всех)     |
| `requiresAuth`       | `boolean`  | Требуется авторизация                             |
| `maxUses`            | `number`   | Общий лимит использований (>= 1, `null` = безлимит) |
| `maxUsesPerUser`     | `number`   | Лимит на одного пользователя (>= 1, `null` = безлимит) |
| `maxItems`           | `number`   | Макс. товаров к которым применяется (null = все)  |
| `minOrderAmount`     | `number`   | Минимальная сумма заказа (>= 0)                   |
| `excludeNewItems`    | `boolean`  | Не применять к новинкам                           |
| `specificProductIds` | `number[]` | ID товаров, к которым применяется                 |
| `excludedProductIds` | `number[]` | ID товаров-исключений                             |
| `validFrom`          | `string`   | Дата начала действия (ISO 8601)                   |
| `validUntil`         | `string`   | Дата окончания действия (ISO 8601)                |
| `isActive`           | `boolean`  | Активен ли промокод                               |

#### Пример запроса - Изменение значения скидки

```http
PUT /api/admin/promo-codes/1
Content-Type: application/json

{
  "value": 25
}
```

#### Пример запроса - Продление срока действия

```http
PUT /api/admin/promo-codes/1
Content-Type: application/json

{
  "validUntil": "2027-06-30T23:59:59Z"
}
```

#### Пример запроса - Включить применение к новинкам

```http
PUT /api/admin/promo-codes/1
Content-Type: application/json

{
  "excludeNewItems": false
}
```

---

### DELETE /api/admin/promo-codes/:id

Полное удаление промокода из базы данных.

#### Параметры пути

| Параметр | Тип      | Описание      |
|----------|----------|--------------|
| `id`     | `number` | ID промокода |

#### Пример запроса

```http
DELETE /api/admin/promo-codes/1
```

#### Пример ответа

```json
{
  "message": "Промокод SALE20 удалён"
}
```

---

### POST /api/admin/promo-codes/:id/deactivate

Деактивация промокода (без удаления). Устанавливает `isActive = false`.

#### Параметры пути

| Параметр | Тип      | Описание      |
|----------|----------|--------------|
| `id`     | `number` | ID промокода |

#### Пример запроса

```http
POST /api/admin/promo-codes/1/deactivate
```

#### Пример ответа

```json
{
  "id": 1,
  "code": "SALE20",
  "type": "PERCENTAGE",
  "value": 20,
  "isActive": false,
  "...":" ..."
}
```

---

### GET /api/admin/promo-codes/:id/stats

Получение статистики использований промокода по пользователям.

#### Параметры пути

| Параметр | Тип      | Описание      |
|----------|----------|--------------|
| `id`     | `number` | ID промокода |

#### Пример запроса

```http
GET /api/admin/promo-codes/1/stats
```

#### Пример ответа

```json
{
  "promoCodeId": 1,
  "code": "FRIENDS25",
  "maxUses": 10,
  "maxUsesPerUser": 2,
  "totalUsedCount": 4,
  "userStats": [
    {
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "ivan@example.com",
        "firstName": "Иван",
        "lastName": "Петров"
      },
      "usageCount": 2
    },
    {
      "user": {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "email": "maria@example.com",
        "firstName": "Мария",
        "lastName": "Иванова"
      },
      "usageCount": 1
    }
  ]
}
```

> **Примечание:** Гостевые использования (userId=null) не включаются в userStats, но учитываются в totalUsedCount.

---

## UX Рекомендации для фронтенда

Полный гайд по отображению полей при создании/редактировании промокода.

### Шаг 1: Тип промокода (`type`)

| Выбран тип | Поля для показа | Поля для скрытия |
|------------|-----------------|------------------|
| `PERCENTAGE` | `value` (1-100, label: "Процент скидки %") | — |
| `FIXED` | `value` (label: "Сумма скидки в ₽") | — |
| `FREE_DELIVERY` | — | `value`, `appliesTo`, `specificProductIds`, `excludedProductIds`, `maxItems`, `excludeNewItems` |

> **FREE_DELIVERY:** Автоматически устанавливай `value: 0`, `appliesTo: 'ALL'`. Скрывай все поля кроме: код, пользователи, лимиты, даты, минимальная сумма.

---

### Шаг 2: К чему применяется (`appliesTo`)

*Показывать только если `type` ≠ `FREE_DELIVERY`*

| Выбрано | Показывать | Скрывать | Откуда брать данные |
|---------|------------|----------|---------------------|
| `ALL` | `excludedProductIds` (опционально), `excludeNewItems` | `specificProductIds` | — |
| `PRODUCT` | `specificProductIds` (обязательно), `excludeNewItems` | — | `GET /api/products` |

> **Для `excludedProductIds`:** Показывать при любом `appliesTo`. Позволяет исключить товары из скидки.

---

### Шаг 3: Новинки (`excludeNewItems`)

*Показывать только если `type` ≠ `FREE_DELIVERY`*

| Значение | Поведение |
|----------|-----------|
| `true` (по умолчанию) | Промокод НЕ применяется к товарам с cardStatus='NEW' |
| `false` | Промокод применяется ко всем товарам, включая новинки |

Checkbox: "Не применять к новинкам" (checked по умолчанию)

---

### Шаг 4: Для кого промокод (целевая аудитория)

| Вариант | Поля | Описание |
|---------|------|----------|
| Для всех (включая гостей) | `requiresAuth: false`, `allowedUserIds: []` | По умолчанию |
| Только для зарегистрированных (любых) | `requiresAuth: true`, `allowedUserIds: []` | Промокод для всех авторизованных, но не для гостей |
| Только для конкретных пользователей | `requiresAuth: false`, `allowedUserIds: [uuid1, uuid2, ...]` | Персональный промокод |

**Важно:**
- `requiresAuth: true` + `allowedUserIds: []` = для **всех зарегистрированных** пользователей
- `requiresAuth: false` + `allowedUserIds: [...]` = только для **конкретных пользователей**
- Если оба параметра активны, `allowedUserIds` имеет приоритет

---

### Шаг 5: Лимиты использования

**Зависит от выбора целевой аудитории:**

| Целевая аудитория | Показывать | Скрывать | Почему |
|-------------------|------------|----------|--------|
| Для всех (`requiresAuth: false`, `allowedUserIds: []`) | `maxUses`, `maxUsesPerUser` | — | Нужны оба лимита |
| Для зарегистрированных (`requiresAuth: true`, `allowedUserIds: []`) | `maxUses`, `maxUsesPerUser` | — | Нужны оба лимита |
| Для конкретных пользователей (`allowedUserIds: [...]`) | `maxUsesPerUser` | `maxUses` | Общий лимит = кол-во пользователей × maxUsesPerUser |

#### Валидация и предупреждения для публичных промокодов

Когда `requiresAuth: false` и `allowedUserIds: []` (для всех включая гостей), проверяй комбинацию `maxUses` и `maxUsesPerUser`:

| `maxUses` | `maxUsesPerUser` | Статус | Действие |
|-----------|------------------|--------|----------|
| `null` | `null` | ⚠️ Опасно | Показать предупреждение: "Промокод без лимитов — может быть использован неограниченно" |
| `1000` | `null` | ⚠️ Опасно | Показать предупреждение: "Один пользователь может использовать все 1000 раз" |
| `1000` | `1` | ✅ Безопасно | Максимум 1000 пользователей по 1 разу |
| `null` | `1` | ✅ Безопасно | Неограниченно пользователей, но каждый только 1 раз |

---

### Шаг 6: Дополнительные ограничения

| Поле | Когда показывать | Описание |
|------|------------------|----------|
| `minOrderAmount` | Всегда | Минимальная сумма заказа (в ₽) |
| `maxItems` | `type` ≠ `FREE_DELIVERY` | Макс. товаров для скидки (null = все). Применяется к N самым дорогим |
| `validFrom` | Всегда | Дата начала действия |
| `validUntil` | Всегда | Дата окончания действия |
| `isActive` | Всегда | Активен ли промокод |

---

### Сводная таблица: все поля

| Поле | PERCENTAGE | FIXED | FREE_DELIVERY | Зависит от |
|------|------------|-------|---------------|------------|
| `code` | ✅ | ✅ | ✅ | — |
| `value` | ✅ (1-100%) | ✅ (сумма ₽) | ❌ (авто: 0) | `type` |
| `appliesTo` | ✅ | ✅ | ❌ (авто: ALL) | `type` |
| `specificProductIds` | если PRODUCT | если PRODUCT | ❌ | `appliesTo` |
| `excludedProductIds` | ✅ | ✅ | ❌ | `type` |
| `excludeNewItems` | ✅ | ✅ | ❌ | `type` |
| `allowedUserIds` | ✅ | ✅ | ✅ | — |
| `requiresAuth` | ✅ | ✅ | ✅ | — |
| `maxUses` | если для всех | если для всех | если для всех | `allowedUserIds` |
| `maxUsesPerUser` | ✅ | ✅ | ✅ | — |
| `maxItems` | ✅ | ✅ | ❌ | `type` |
| `minOrderAmount` | ✅ | ✅ | ✅ | — |
| `validFrom` | ✅ | ✅ | ✅ | — |
| `validUntil` | ✅ | ✅ | ✅ | — |
| `isActive` | ✅ | ✅ | ✅ | — |

---

## Коды ошибок

| Код | Описание                                |
|-----|-----------------------------------------|
| 400 | Bad Request - некорректные данные или дубликат активного кода |
| 401 | Unauthorized - отсутствует или невалидный токен авторизации |
| 403 | Forbidden - недостаточно прав (требуется AdminGuard) |
| 404 | Not Found - промокод не найден |
| 500 | Internal Server Error - внутренняя ошибка сервера |

---

## Примечания

1. **Автоматическое преобразование кода**: Код промокода автоматически преобразуется в верхний регистр при создании и обновлении.

2. **Автоматическая генерация описания**: При создании и обновлении промокода автоматически генерируется человекочитаемое описание на основе параметров.

3. **Повторное использование кодов**: Можно создавать промокоды с кодами, которые ранее использовались, если предыдущий промокод:
   - Деактивирован (`isActive: false`)
   - Истёк (`validUntil` в прошлом)
   - Исчерпал лимит (`usedCount >= maxUses`)

4. **Валидация**: Все входные данные валидируются с помощью `class-validator`. Ошибки валидации возвращаются с кодом 400.

5. **Ограничение доступа к промокоду**:
   - `requiresAuth: false` + пустой `allowedUserIds` = для всех (включая гостей)
   - `requiresAuth: true` + пустой `allowedUserIds` = только для зарегистрированных пользователей (любых)
   - Заполненный `allowedUserIds` = только для авторизованных пользователей с указанными UUID
   - При попытке использования недоступного промокода гость получит ошибку:
     - "Промокод доступен только для зарегистрированных пользователей" (если `requiresAuth: true`)
     - "Промокод недоступен для вас" (если промокод персональный)

6. **Лимиты использования**:
   - `maxUses` — общий лимит использований промокода (для всех пользователей суммарно)
   - `maxUsesPerUser` — лимит использований для каждого пользователя индивидуально
   - Если `maxUses = null` — промокод можно использовать неограниченное количество раз
   - Если `maxUsesPerUser = null` — один пользователь может использовать промокод неограниченно
   - **Важно:** Для промокодов с конкретными пользователями не показывайте `maxUses` — используйте только `maxUsesPerUser`

7. **Новинки (`excludeNewItems`)**:
   - По умолчанию `true` — промокоды PERCENTAGE и FIXED не применяются к товарам с `cardStatus='NEW'`
   - FREE_DELIVERY всегда применяется к новинкам независимо от этого флага
   - Можно отключить проверку, установив `excludeNewItems=false`

8. **Промокод FREE_DELIVERY**:
   - Даёт бесплатную доставку, не влияет на стоимость товаров
   - Поле `value` должно быть `0`
   - Автоматически `appliesTo = ALL`

9. **Пагинация**: По умолчанию возвращается до 50 записей на страницу.

10. **Авторизация**: Для всех эндпоинтов требуется AdminGuard - токен администратора, полученный через авторизацию в Telegram.
