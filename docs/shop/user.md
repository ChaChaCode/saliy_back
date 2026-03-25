# API профиля пользователя

## Структура данных

```typescript
{
  id: string;              // UUID
  email: string;           // Email (уникальный)

  // Персональные данные
  firstName?: string;      // Имя
  lastName?: string;       // Фамилия
  middleName?: string;     // Отчество
  phone?: string;          // Телефон

  // Адрес доставки
  street?: string;         // Улица и номер дома
  apartment?: string;      // Квартира
  postalCode?: string;     // Почтовый индекс

  // CDEK локация (автоматически)
  cdekCityCode?: number;      // Код города CDEK
  cdekCountryCode?: string;   // Код страны CDEK
  cdekRegionCode?: number;    // Код региона CDEK
  cityName?: string;          // Название города
  countryName?: string;       // Название страны
  regionName?: string;        // Название региона

  createdAt: Date;         // Дата регистрации
  updatedAt: Date;         // Дата обновления
}
```

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
  "phone": "+79991234567",
  "street": "ул. Пушкина, д. 5",
  "apartment": "12",
  "postalCode": "190000"
}
```

Все поля опциональные.

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
  "street": "ул. Пушкина, д. 5",
  "apartment": "12",
  "postalCode": "190000",
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

### Адрес
- Все поля опциональны
- Рекомендуется заполнить для оформления заказа

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

## Полный сценарий

```bash
# 1. Получить профиль
curl -X GET https://saliy-shop.ru/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 2. Обновить профиль
curl -X PUT https://saliy-shop.ru/api/auth/profile \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+79991234567"
  }'

# 3. Выбрать город доставки
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cdekCityCode": 44}'
```
