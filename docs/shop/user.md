# API профиля пользователя

## Структура данных

```typescript
{
  id: string;              // UUID
  email: string;           // Email (уникальный, НЕ редактируется)

  // Персональные данные (редактируемые)
  firstName?: string;      // Имя
  lastName?: string;       // Фамилия
  middleName?: string;     // Отчество
  phone?: string;          // Телефон

  // Тип доставки (выбирается первым шагом)
  deliveryType?: 'CDEK' | 'POST'; // CDEK - самовывоз из ПВЗ, POST - почта

  // CDEK доставка (если deliveryType = 'CDEK')
  cdekCityCode?: number;           // Код города CDEK
  cdekCountryCode?: string;        // Код страны CDEK (RU/BY)
  cdekRegionCode?: number;         // Код региона CDEK
  cdekPickupPointCode?: string;    // Код выбранного ПВЗ
  cityName?: string;               // Название города
  countryName?: string;            // Название страны
  regionName?: string;             // Название региона

  // Почтовая доставка (если deliveryType = 'POST')
  deliveryCountryCode?: string;    // Код страны (любая)
  fullAddress?: string;            // Полный адрес одной строкой
  postalCode?: string;             // Почтовый индекс (ТОЛЬКО для POST)

  createdAt: Date;         // Дата регистрации
  updatedAt: Date;         // Дата обновления
}
```

---

## Логика работы профиля

### Что можно редактировать:
- ✅ **Персональные данные**: имя, фамилия, отчество, телефон
- ✅ **Адрес доставки**: через `/auth/delivery-location`
- ❌ **Email**: НЕ редактируется (привязан к аккаунту)

### Порядок заполнения:
1. Пользователь регистрируется по email
2. Заполняет имя, фамилию, телефон в профиле
3. **Выбирает тип доставки:**
   - **CDEK** - самовывоз из ПВЗ (только RU/BY)
   - **POST** - обычная почтовая доставка (любая страна)
4. **Если CDEK:**
   - Выбирает страну (RU или BY)
   - Выбирает регион
   - Выбирает город
   - Выбирает пункт выдачи
5. **Если POST:**
   - Выбирает страну
   - Вводит полный адрес (одна строка)
   - Вводит почтовый индекс

### Частичное сохранение:
✅ **Можно сохранять адрес доставки частями:**
- Сначала только тип доставки: `{ "deliveryType": "CDEK" }`
- Потом добавить город: `{ "cdekCityCode": 44 }`
- Затем пункт выдачи: `{ "cdekPickupPointCode": "MSK123" }`
- Или всё сразу в одном запросе

⚠️ **Важно:**
- При смене типа доставки (CDEK ↔ POST) автоматически очищаются поля другого типа
- Для выбора пункта выдачи CDEK сначала нужно выбрать город
- Все поля опциональны, можно обновлять по одному

---

## Эндпоинты

### 1. Получить профиль

**GET** `/api/auth/me`

**Требуется авторизация:** Да

**Пример запроса:**
```bash
curl -X GET https://saliy-shop.ru/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Пример ответа (CDEK):**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "phone": "+79991234567",
  "deliveryType": "CDEK",
  "cdekCityCode": 44,
  "cdekCountryCode": "RU",
  "cdekRegionCode": 77,
  "cdekPickupPointCode": "MSK123",
  "cityName": "Москва",
  "countryName": "Россия",
  "regionName": "Москва",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:25:00.000Z"
}
```

**Пример ответа (POST):**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "phone": "+48123456789",
  "deliveryType": "POST",
  "deliveryCountryCode": "PL",
  "countryName": "Польша",
  "fullAddress": "Варшава, ул. Новы Свят, д. 10, кв. 5",
  "postalCode": "00-001",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:25:00.000Z"
}
```

---

### 2. Обновить профиль

**PUT** `/api/auth/profile`

**Требуется авторизация:** Да

**Тело запроса:**
```json
{
  "firstName": "Иван",
  "lastName": "Петров",
  "middleName": "Сергеевич",
  "phone": "+79991234567"
}
```

Все поля опциональные.

**Примечание:** Адрес доставки редактируется через отдельный эндпоинт `/auth/delivery-location`.

---

### 3. Обновить адрес доставки

**PUT** `/api/auth/delivery-location`

**Требуется авторизация:** Да

**Все поля опциональны** - можно обновлять частями или всё сразу.

---

#### Вариант CDEK: Самовывоз из ПВЗ (только RU/BY)

**Тело запроса (полное):**
```json
{
  "deliveryType": "CDEK",
  "cdekCityCode": 44,
  "cdekPickupPointCode": "MSK123"
}
```

**Пример запроса:**
```bash
# 1. Найти город
curl "https://saliy-shop.ru/api/delivery/cities?countryCode=RU&search=Москва"
# Получить cityCode

# 2. Получить пункты выдачи
curl "https://saliy-shop.ru/api/delivery/pickup-points?cityCode=44"
# Получить pickupPointCode

# 3. Сохранить в профиле
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryType": "CDEK",
    "cdekCityCode": 44,
    "cdekPickupPointCode": "MSK123"
  }'
```

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "phone": "+79991234567",
  "deliveryType": "CDEK",
  "cdekCityCode": 44,
  "cdekCountryCode": "RU",
  "cdekRegionCode": 77,
  "cdekPickupPointCode": "MSK123",
  "cityName": "Москва",
  "countryName": "Россия",
  "regionName": "Москва",
  "deliveryCountryCode": null,
  "fullAddress": null,
  "postalCode": null
}
```

---

#### Вариант POST: Почтовая доставка (любая страна)

**Тело запроса (полное):**
```json
{
  "deliveryType": "POST",
  "deliveryCountryCode": "PL",
  "fullAddress": "Варшава, ул. Новы Свят, д. 10, кв. 5",
  "postalCode": "00-001"
}
```

**Пример запроса:**
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

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "phone": "+48123456789",
  "deliveryType": "POST",
  "deliveryCountryCode": "PL",
  "countryName": "Польша",
  "fullAddress": "Варшава, ул. Новы Свят, д. 10, кв. 5",
  "postalCode": "00-001",
  "cdekCityCode": null,
  "cdekPickupPointCode": null
}
```

---

#### Частичное сохранение адреса

**Все поля опциональны** - можно обновлять по одному или группами.

**Пример 1: Сначала выбрать тип доставки**
```bash
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryType": "CDEK"
  }'
```

**Пример 2: Затем добавить город (CDEK)**
```bash
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cdekCityCode": 44
  }'
```

**Пример 3: Добавить пункт выдачи (CDEK)**
```bash
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cdekPickupPointCode": "MSK123"
  }'
```

**Пример 4: Частичное обновление для POST**
```bash
# Сначала тип и страна
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryType": "POST",
    "deliveryCountryCode": "PL"
  }'

# Потом адрес и индекс
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullAddress": "Варшава, ул. Новы Свят, д. 10, кв. 5",
    "postalCode": "00-001"
  }'
```

**⚠️ Важно:**
- При смене `deliveryType` (CDEK → POST или наоборот) автоматически очищаются поля другого типа
- Для добавления `cdekPickupPointCode` сначала нужно выбрать `cdekCityCode`
- Можно обновлять одно поле или несколько сразу

---

## Валидация

### Телефон
- Формат: международный с кодом страны
- Пример: `+79991234567`

### Имя, Фамилия, Отчество
- Минимум: 1 символ
- Максимум: 100 символов

### Адрес доставки
- **deliveryType** - опционально ("CDEK" или "POST")
- **CDEK**: cdekCityCode, cdekPickupPointCode (все опциональны, можно сохранять частями)
- **POST**: deliveryCountryCode, fullAddress, postalCode (все опциональны, можно сохранять частями)
- Для выбора пункта выдачи CDEK сначала нужно выбрать город
- При смене типа доставки поля другого типа очищаются

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные |
| 401 | Не авторизован |
| 404 | Не найдено |
| 500 | Ошибка сервера |

---

## Полный сценарий заполнения профиля

```bash
# 1. Авторизоваться (получить токен)
# См. docs/shop/auth.md

# 2. Получить профиль
curl -X GET https://saliy-shop.ru/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 3. Обновить персональные данные
curl -X PUT https://saliy-shop.ru/api/auth/profile \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+79991234567"
  }'

# 4. Выбрать тип доставки и установить адрес

# === Вариант А: CDEK ===
# Найти город
curl "https://saliy-shop.ru/api/delivery/cities?countryCode=RU&search=Москва"

# Найти ПВЗ
curl "https://saliy-shop.ru/api/delivery/pickup-points?cityCode=44"

# Сохранить
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryType": "CDEK",
    "cdekCityCode": 44,
    "cdekPickupPointCode": "MSK123"
  }'

# === Вариант Б: POST ===
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
