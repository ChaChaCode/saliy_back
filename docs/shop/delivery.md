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
      "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
    },
    {
      "code": "BY",
      "name": "Беларусь",
      "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
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
  "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
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

Рассчитывает стоимость доставки для самовывоза и курьера.

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
    "deliverySum": 350,
    "periodMin": 2,
    "periodMax": 4,
    "calendarMin": 2,
    "calendarMax": 4,
    "currency": "RUB"
  },
  "courier": {
    "tariffCode": 137,
    "tariffName": "Посылка склад-дверь",
    "tariffDescription": "Доставка курьером до двери",
    "deliverySum": 450,
    "periodMin": 2,
    "periodMax": 5,
    "calendarMin": 2,
    "calendarMax": 5,
    "currency": "RUB"
  }
}
```

**Описание полей:**
- `deliverySum` - Стоимость доставки в рублях
- `periodMin/Max` - Срок доставки в рабочих днях
- `calendarMin/Max` - Срок доставки в календарных днях

---

## Сценарий выбора доставки

### Шаг 1: Выбрать страну

```bash
curl "https://saliy-shop.ru/api/delivery/countries?lang=ru"
```

Пользователь выбирает страну из списка (например, RU).

### Шаг 2: Если страна RU или BY - искать город

```bash
# Поиск города по названию
curl "https://saliy-shop.ru/api/delivery/cities?countryCode=RU&search=Москва"
```

Или выбрать регион, затем город:

```bash
# 1. Получить регионы
curl "https://saliy-shop.ru/api/delivery/regions?countryCode=RU"

# 2. Получить города региона
curl "https://saliy-shop.ru/api/delivery/cities?countryCode=RU&regionCode=77"
```

### Шаг 3: Сохранить город в профиле

```bash
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cdekCityCode": 44}'
```

После этого в профиле автоматически заполнятся:
- `cdekCityCode` - 44
- `cdekCountryCode` - "RU"
- `cdekRegionCode` - 77
- `cityName` - "Москва"
- `countryName` - "Россия"
- `regionName` - "Москва"

### Шаг 4: Рассчитать стоимость доставки

```bash
curl "https://saliy-shop.ru/api/delivery/prices?cityCode=44&weight=650"
```

### Шаг 5: Выбрать способ доставки

**Вариант А: Самовывоз из ПВЗ**
```bash
# Получить список пунктов выдачи
curl "https://saliy-shop.ru/api/delivery/pickup-points?cityCode=44"

# Пользователь выбирает ПВЗ и сохраняет его код
```

**Вариант Б: Курьерская доставка**
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

| Тип | Код | Описание |
|-----|-----|----------|
| Самовывоз из ПВЗ | `CDEK_PICKUP` | Пользователь забирает заказ из пункта выдачи CDEK |
| Курьер до двери | `CDEK_COURIER` | Курьер доставляет заказ по адресу |
| Стандартная доставка | `STANDARD` | Для стран без поддержки CDEK |

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
8a. Если самовывоз:
    - Выбор ПВЗ
      [GET /delivery/pickup-points?cityCode=44]
    - Пользователь выбирает удобный ПВЗ

8b. Если курьер:
    - Заполнение адреса
      [PUT /auth/profile]
   ↓
9. Создание заказа
   ↓
10. Оплата
```

---

## Важные замечания

### Вес товара
- Вес хранится в граммах в поле `weight` товара
- При расчёте доставки суммируется вес всех товаров в корзине

### Склад отправки
- Склад настраивается через переменную `CDEK_WAREHOUSE_CITY_CODE` в `.env`
- По умолчанию: 9220 (Брест, Беларусь)

### Тестовый режим
- Если `CDEK_TEST_MODE=true`, используется тестовый API CDEK
- Тестовые креденшелы: `CDEK_CLIENT_ID_TEST` и `CDEK_CLIENT_SECRET_TEST`

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
