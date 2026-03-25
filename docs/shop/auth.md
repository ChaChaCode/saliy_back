# API авторизации и профиля пользователя

## Авторизация

### 1. Отправить код подтверждения

**POST** `/api/auth/send-code`

Отправляет 4-значный код подтверждения на email.

**Тело запроса:**
```json
{
  "email": "user@example.com"
}
```

**Пример запроса:**
```bash
curl -X POST https://saliy-shop.ru/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Пример ответа:**
```json
{
  "message": "Код отправлен на email"
}
```

**Ошибки:**
- `400` - Код уже был отправлен, повторная отправка через N секунд

---

### 2. Подтвердить код и авторизоваться

**POST** `/api/auth/verify-code`

Подтверждает код и возвращает access token. Refresh token устанавливается в httpOnly cookie.

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "code": "1234"
}
```

**Пример запроса:**
```bash
curl -X POST https://saliy-shop.ru/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "code": "1234"}'
```

**Пример ответа:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Успешная авторизация"
}
```

**Cookie:**
- `refreshToken` - httpOnly, secure, 7 дней

**Ошибки:**
- `401` - Неверный или истекший код

---

### 3. Обновить access token

**POST** `/api/auth/refresh`

Обновляет access token используя refresh token из cookie.

**Пример запроса:**
```bash
curl -X POST https://saliy-shop.ru/api/auth/refresh \
  --cookie "refreshToken=..."
```

**Пример ответа:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Токен обновлен"
}
```

**Ошибки:**
- `401` - Refresh token не найден или недействителен

---

### 4. Выйти из системы

**POST** `/api/auth/logout`

Удаляет refresh token и очищает cookie.

**Пример запроса:**
```bash
curl -X POST https://saliy-shop.ru/api/auth/logout \
  --cookie "refreshToken=..."
```

**Пример ответа:**
```json
{
  "message": "Выход выполнен"
}
```

---

## Профиль пользователя

### Структура данных

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
# 1. Отправить код
curl -X POST https://saliy-shop.ru/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 2. Подтвердить код
curl -X POST https://saliy-shop.ru/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "code": "1234"}'
# Сохранить accessToken из ответа

# 3. Получить профиль
curl -X GET https://saliy-shop.ru/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 4. Обновить профиль
curl -X PUT https://saliy-shop.ru/api/auth/profile \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "phone": "+79991234567"
  }'

# 5. Выбрать город доставки
curl -X PUT https://saliy-shop.ru/api/auth/delivery-location \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cdekCityCode": 44}'
```
