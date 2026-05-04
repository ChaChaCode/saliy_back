# API доставки (CDEK)

Интеграция с CDEK для расчёта стоимости доставки, выбора пунктов выдачи и создания заказов.

---

## Поддерживаемые страны

CDEK доступен для:
- 🇷🇺 Россия (RU)
- 🇧🇾 Беларусь (BY)

Для остальных стран доступна только стандартная доставка.

---

## Эндпоинты

### 1. Получить список стран

**GET** `/api/delivery/countries?lang=ru`

Возвращает список всех стран с типами доставки.

**Query параметры:**
- `lang` - Язык (ru/en/pl, по умолчанию ru)

**Пример запроса:**
```bash
curl "https://saliy-shop.ru/api/delivery/countries?lang=ru"
```

**Пример ответа:**
```json
{
  "countries": [
    {
      "code": "RU",
      "name": "Россия",
      "deliveryTypes": ["CDEK_PICKUP"]
    },
    {
      "code": "BY",
      "name": "Беларусь",
      "deliveryTypes": ["CDEK_PICKUP"]
    },
    {
      "code": "PL",
      "name": "Польша",
      "deliveryTypes": ["STANDARD"]
    }
  ]
}
```

---

### 2. Получить информацию о стране

**GET** `/api/delivery/countries/:code?lang=ru`

**Пример запроса:**
```bash
curl "https://saliy-shop.ru/api/delivery/countries/RU?lang=ru"
```

**Пример ответа:**
```json
{
  "code": "RU",
  "name": "Россия",
  "deliveryTypes": ["CDEK_PICKUP"]
}
```

---

### 3. Получить регионы страны

**GET** `/api/delivery/regions?countryCode=RU`

**Query параметры:**
- `countryCode` - Код страны (обязательно)

**Пример запроса:**
```bash
curl "https://saliy-shop.ru/api/delivery/regions?countryCode=RU"
```

**Пример ответа:**
```json
{
  "regions": [
    {
      "code": 77,
      "name": "Москва",
      "countryCode": "RU"
    },
    {
      "code": 78,
      "name": "Санкт-Петербург",
      "countryCode": "RU"
    }
  ]
}
```

---

### 4. Получить города

**GET** `/api/delivery/cities?countryCode=RU&regionCode=77&search=Москва`

**Query параметры:**
- `countryCode` - Код страны (обязательно)
- `regionCode` - Код региона (опционально)
- `search` - Поиск по названию города (опционально)

**Пример запроса:**
```bash
curl "https://saliy-shop.ru/api/delivery/cities?countryCode=RU&search=Москва"
```

**Пример ответа:**
```json
{
  "cities": [
    {
      "code": 44,
      "name": "Москва",
      "regionCode": 77,
      "region": "Москва",
      "countryCode": "RU"
    }
  ]
}
```

---

### 5. Получить пункты выдачи CDEK

**GET** `/api/delivery/pickup-points?cityCode=44`

**Query параметры:**
- `cityCode` - Код города CDEK (обязательно)

**Пример запроса:**
```bash
curl "https://saliy-shop.ru/api/delivery/pickup-points?cityCode=44"
```

**Пример ответа:**
```json
{
  "points": [
    {
      "code": "MSK123",
      "name": "CDEK на Тверской",
      "address": "г. Москва, ул. Тверская, д. 10",
      "city": "Москва",
      "coordinates": [37.614, 55.755],
      "workTime": "Пн-Пт: 09:00-20:00, Сб-Вс: 10:00-18:00",
      "phones": ["+74951234567"],
      "isDressingRoom": true,
      "haveCashless": true
    }
  ]
}
```

---

### 6. Рассчитать стоимость доставки

**GET** `/api/delivery/prices?cityCode=44&weight=500&currency=RUB`

Рассчитывает стоимость доставки для самовывоза.

**Query параметры:**
- `cityCode` - Код города CDEK (обязательно)
- `weight` - Вес товара в граммах (по умолчанию 500)
- `currency` - Валюта (по умолчанию RUB)

**Пример запроса:**
```bash
curl "https://saliy-shop.ru/api/delivery/prices?cityCode=44&weight=650"
```

**Пример ответа:**
```json
{
  "pickup": {
    "tariffCode": 136,
    "tariffName": "Посылка склад-склад",
    "tariffDescription": "Самовывоз из пункта выдачи CDEK",
    "deliverySum": 500,
    "periodMin": 2,
    "periodMax": 4,
    "calendarMin": 2,
    "calendarMax": 4,
    "currency": "RUB"
  }
}
```

**Описание полей:**
- `deliverySum` - **Реальная стоимость** доставки от CDEK API (зависит от города и веса)
- `periodMin/Max` - Срок доставки в рабочих днях
- `calendarMin/Max` - Срок доставки в календарных днях

> **Важно:** этот же расчёт используется на бэке при создании заказа — клиент платит ровно столько, сколько здесь увидел. Если CDEK API недоступен в момент оформления, бэк использует fallback из админских настроек (`delivery_price_cdek`, по умолчанию 500₽).

---

## Сценарий выбора доставки

### Шаг 1: Выбрать страну

```bash
curl "https://saliy-shop.ru/api/delivery/countries?lang=ru"
```

Пользователь выбирает страну из списка. Ответ содержит поле `deliveryTypes`:

```json
{
  "code": "RU",
  "name": "Россия",
  "deliveryTypes": ["CDEK_PICKUP"]
}
```

**Логика фронтенда:**
- Если `deliveryTypes` содержит `"CDEK_PICKUP"` → **Вариант А** (выбор через селекты, самовывоз из ПВЗ)
- Иначе → **Вариант Б** (ввод адреса вручную, почтовая доставка)

---

### Вариант А: Страны с CDEK (RU, BY)

#### Шаг 2А: Выбрать регион и город

**Основной способ (рекомендуется):**

```bash
# 1. Получить регионы
curl "https://saliy-shop.ru/api/delivery/regions?countryCode=RU"

# 2. Получить города региона (обязательно указать regionCode)
curl "https://saliy-shop.ru/api/delivery/cities?countryCode=RU&regionCode=81"
```

**Альтернатива - поиск по названию:**

```bash
# Поиск города по названию (без выбора региона)
curl "https://saliy-shop.ru/api/delivery/cities?countryCode=RU&search=Москва"
```

⚠️ **Важно:** Без `regionCode` или `search` API вернет ошибку, так как список из 1500+ городов неудобен для выбора.

#### Шаг 3А: Сохранить в профиле

```bash
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deliveryType": "CDEK", "cdekCityCode": 44}'
```

После этого в профиле автоматически заполнятся:
- `deliveryType` - "CDEK"
- `cdekCityCode` - 44
- `cdekCountryCode` - "RU"
- `cdekRegionCode` - 77
- `cityName` - "Москва"
- `countryName` - "Россия"
- `regionName` - "Москва"

---

### Вариант Б: Другие страны (без CDEK)

#### Шаг 2Б: Ввести адрес вручную

Фронтенд показывает поля:
- Полный адрес (одна строка): "регион, город, улица, дом, квартира"
- Почтовый индекс

#### Шаг 3Б: Сохранить в профиле

```bash
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryType": "POST",
    "deliveryCountryCode": "PL",
    "fullAddress": "Варшава, ул. Новы Свят, д. 10, кв. 5",
    "postalCode": "00-001"
  }'
```

После этого в профиле заполнятся:
- `deliveryType` - "POST"
- `deliveryCountryCode` - "PL"
- `countryName` - "Польша"
- `fullAddress` - "Варшава, ул. Новы Свят, д. 10, кв. 5"
- `postalCode` - "00-001"

### Шаг 4: Рассчитать стоимость доставки

```bash
curl "https://saliy-shop.ru/api/delivery/prices?cityCode=44&weight=650"
```

### Шаг 5: Выбрать способ доставки

**Для России/Беларуси: Самовывоз из ПВЗ CDEK**
```bash
# Получить список пунктов выдачи
curl "https://saliy-shop.ru/api/delivery/pickup-points?cityCode=44"

# Пользователь выбирает ПВЗ и сохраняет его код
```

**Для других стран: Почтовая доставка**
```bash
# Пользователь вводит адрес в профиле
curl -X PUT https://saliy-shop.ru/api/auth/profile \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "ул. Пушкина, д. 5",
    "apartment": "12",
    "postalCode": "190000"
  }'
```

---

## Интеграция с профилем

Поля в профиле пользователя для доставки:

```typescript
{
  // CDEK локация (заполняется автоматически)
  cdekCityCode: 44,          // Код города CDEK
  cdekCountryCode: "RU",     // Код страны CDEK
  cdekRegionCode: 77,        // Код региона CDEK
  cityName: "Москва",        // Название города
  countryName: "Россия",     // Название страны
  regionName: "Москва",      // Название региона

  // Адрес (заполняет пользователь для курьерской доставки)
  street: "ул. Пушкина, д. 5",
  apartment: "12",
  postalCode: "190000"
}
```

---

## Типы доставки

| Тип | Код | Цена | Страны |
|-----|-----|------|--------|
| Самовывоз из ПВЗ CDEK | `CDEK_PICKUP` | **CDEK API** по городу + весу. Fallback — `delivery_price_cdek` (по умолчанию 500₽) | 🇷🇺 Россия, 🇧🇾 Беларусь |
| Почтовая доставка | `STANDARD` | Фикс из админских настроек (`delivery_price_standard`, по умолчанию 800₽) | Все остальные страны |

---

## Пример UI flow

```
1. Регистрация/Вход
   ↓
2. Заполнение профиля
   ↓
3. Выбор страны доставки
   [GET /delivery/countries]
   ↓
4. Если RU/BY - выбор города
   [GET /delivery/cities?search=...]
   ↓
5. Сохранение города в профиле
   [PUT /auth/delivery-location]
   ↓
6. Добавление товаров в корзину
   ↓
7. Оформление заказа:
   - Расчёт веса товаров
   - Получение цен доставки
     [GET /delivery/prices?cityCode=44&weight=650]
   ↓
8a. Если Россия/Беларусь (CDEK_PICKUP):
    - Выбор ПВЗ
      [GET /delivery/pickup-points?cityCode=44]
    - Пользователь выбирает удобный ПВЗ

8b. Если другие страны (STANDARD):
    - Заполнение адреса
      [PUT /auth/profile]
   ↓
9. Создание заказа
   ↓
10. Оплата (Яндекс Пей - автоуспех)
```

---

## Расчёт стоимости (как это работает на бэке)

При вызове `POST /api/orders/calculate` или `POST /api/orders` бэк:

1. **Вес фиксированный — 500 г на любой заказ** (по бизнес-решению, см. [src/orders/orders.service.ts](../../src/orders/orders.service.ts) — поле `weight` у товара не используется в расчёте доставки).
2. Если `deliveryType === 'CDEK_PICKUP'` и передан `cdekCityCode`:
   - **Шаг A.** Точечный запрос `POST /v2/calculator/tariff` с `tariff_code = 136` («Посылка склад-склад»). Если CDEK вернул цену — берём её.
   - **Шаг B (fallback).** Если CDEK ответил `400` (например, тариф недоступен для маршрута) — дёргается `POST /v2/calculator/tarifflist`, и среди всех тарифов выбирается самый дешёвый «склад-склад» (по `tariff_name`), либо «X-склад» (последняя нога в ПВЗ).
   - **Шаг C (fallback).** Если ни один тариф не подошёл — берётся фикс из админских настроек `delivery_price_cdek` (по умолчанию 500₽).
3. Если `deliveryType === 'STANDARD'` → фикс из `delivery_price_standard` (по умолчанию 800₽).

> **Что увидеть в логах backend'а:**
> - ✅ `[OrdersService] CDEK price: city=259, weight=500г → 338 ₽ [тариф 136: Посылка склад-склад]` — реальный расчёт через тариф 136
> - ⚠️ `[DeliveryService] CDEK direct tariff 136 недоступен — fallback на tarifflist` — пошёл в шаг B
> - ⚠️ `Fallback 500 ₽` — пошёл в шаг C (CDEK не дал ни одного подходящего тарифа)

### Поле response `deliveryPrice`

В ответе `/api/orders/calculate` и `/api/orders` поле `deliveryPrice` (внутри объекта суммы заказа) содержит **итоговую цену**, которую заплатит клиент. Это то же число, что вернёт `GET /api/delivery/prices?cityCode=...&weight=...` для тех же параметров.

---

## Важные замечания

### Вес посылки
- **Фиксирован на стороне backend'а: 500 г для всех заказов.** Поле `weight` у товара в БД сейчас на расчёт доставки не влияет.
- Если бизнес-логика поменяется — настройка в [src/orders/orders.service.ts](../../src/orders/orders.service.ts) (`const weight = 500;`).

### Склад отправителя

Настраивается через переменные в `.env`:

```env
# Код города в системе CDEK (НЕ телефонный код!)
# Москва=44, Санкт-Петербург=137, Брест=9220
CDEK_WAREHOUSE_CITY_CODE=44

# Код тарифа склад-склад (по умолчанию 136 «Посылка склад-склад»)
CDEK_PICKUP_TARIFF_CODE=136

# Конкретный ПВЗ-отправитель (опционально). Если CDEK ругается err_pvz_with_tariff_mistake —
# пропиши код своего ПВЗ или адрес склада, чтобы он распознал точку отправления.
# CDEK_SENDER_PICKUP_POINT=MSK124
```

> ⚠️ **`CDEK_WAREHOUSE_CITY_CODE` — это код города в системе CDEK, а не телефонный код.** Москва = `44`, не `495`. Узнать код своего города можно через `GET /api/delivery/cities?countryCode=RU&search=Москва`, поле `code` в ответе.

### Тестовый режим
- `CDEK_TEST_MODE=true` → тестовый API `https://api.edu.cdek.ru/v2`, тестовые креды `CDEK_CLIENT_ID_TEST` / `CDEK_CLIENT_SECRET_TEST`.
- В тестовой среде у CDEK ограниченное покрытие тарифов — для многих маршрутов нет тарифа «склад-склад». На прод-API (`https://api.cdek.ru/v2`) обычно всё доступно.

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные параметры |
| 404 | Страна/город не найден |
| 500 | Ошибка CDEK API |

---

## См. также

- [Профиль пользователя](./user.md) - Управление данными доставки
- [Заказы](./orders.md) - Создание заказов с доставкой
