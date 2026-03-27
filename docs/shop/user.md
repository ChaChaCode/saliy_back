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

  // Локация доставки (редактируется через отдельный эндпоинт)
  cdekCityCode?: number;      // Код города CDEK
  cdekCountryCode?: string;   // Код страны CDEK
  cdekRegionCode?: number;    // Код региона CDEK
  cityName?: string;          // Название города
  countryName?: string;       // Название страны
  regionName?: string;        // Название региона

  // Адрес доставки (только для чтения, заполняется при оформлении заказа)
  street?: string;         // Улица и номер дома
  apartment?: string;      // Квартира
  postalCode?: string;     // Почтовый индекс

  createdAt: Date;         // Дата регистрации
  updatedAt: Date;         // Дата обновления
}
```

---

## Логика работы профиля

### Что можно редактировать:
- ✅ **Персональные данные**: имя, фамилия, отчество, телефон
- ✅ **Локация доставки**: страна/регион/город (через `/auth/delivery-location`)
- ❌ **Email**: НЕ редактируется (привязан к аккаунту)
- ❌ **Адрес доставки**: НЕ редактируется в профиле (вводится при оформлении заказа)

### Порядок заполнения:
1. Пользователь регистрируется по email
2. Заполняет имя, фамилию, телефон в профиле
3. Выбирает город доставки (страна → регион → город)
4. При оформлении заказа вводит конкретный адрес (улица, квартира)
5. Система автоматически использует данные из профиля + введенный адрес

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

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "middleName": "Сергеевич",
  "phone": "+79991234567",
  "street": "ул. Ленина, д. 10",
  "apartment": "25",
  "postalCode": "123456",
  "cdekCityCode": 44,
  "cdekCountryCode": "RU",
  "cdekRegionCode": 77,
  "cityName": "Москва",
  "countryName": "Россия",
  "regionName": "Москва",
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

**Примечание:** Адрес доставки (улица, квартира) НЕ редактируется через этот эндпоинт. Он вводится при оформлении заказа.

**Пример запроса:**
```bash
curl -X PUT https://saliy-shop.ru/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+79991234567"
  }'
```

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "middleName": "Сергеевич",
  "phone": "+79991234567",
  "cdekCityCode": 44,
  "cityName": "Москва",
  "countryName": "Россия",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T15:45:00.000Z"
}
```

---

### 3. Установить город доставки

**PUT** `/api/auth/delivery-location`

**Требуется авторизация:** Да

**Тело запроса:**
```json
{
  "cdekCityCode": 44
}
```

**Пример запроса:**
```bash
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cdekCityCode": 44}'
```

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "cdekCityCode": 44,
  "cdekCountryCode": "RU",
  "cdekRegionCode": 77,
  "cityName": "Москва",
  "countryName": "Россия",
  "regionName": "Москва",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T16:00:00.000Z"
}
```

---

## Валидация

### Телефон
- Формат: международный с кодом страны
- Пример: `+79991234567`

### Имя, Фамилия, Отчество
- Минимум: 1 символ
- Максимум: 100 символов

### Локация доставки
- Выбирается через `/auth/delivery-location`
- Используется для расчёта стоимости доставки при оформлении заказа

### Адрес доставки
- НЕ редактируется в профиле
- Вводится пользователем при оформлении заказа

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

# 2. Получить текущий профиль
curl -X GET https://saliy-shop.ru/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 3. Обновить персональные данные
curl -X PUT https://saliy-shop.ru/api/auth/profile \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "middleName": "Сергеевич",
    "phone": "+79991234567"
  }'

# 4. Выбрать город доставки
# Сначала найти город через /delivery/cities (см. docs/shop/delivery.md)
# Затем сохранить код города:
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cdekCityCode": 44}'

# 5. Проверить обновленный профиль
curl -X GET https://saliy-shop.ru/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
# Теперь профиль содержит: имя, телефон, город доставки
```

**При оформлении заказа:**
- Система автоматически использует данные из профиля (имя, телефон, город)
- Пользователь дополнительно вводит конкретный адрес доставки (улица, квартира)
