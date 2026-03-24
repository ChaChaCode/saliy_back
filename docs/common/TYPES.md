# Типы данных API

Описание всех типов данных, используемых в API.

---

## User - Пользователь

Основная модель пользователя в системе.

### Поля

| Поле | Тип | Nullable | Описание |
|------|-----|----------|----------|
| id | string (UUID) | Нет | Уникальный идентификатор пользователя |
| email | string | Нет | Email адрес пользователя (уникальный) |
| name | string | Да | Имя пользователя (может быть null) |
| createdAt | string (DateTime) | Нет | Дата и время создания аккаунта |
| updatedAt | string (DateTime) | Нет | Дата и время последнего обновления |

### Пример (JSON)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": null,
  "createdAt": "2026-03-24T20:00:00.000Z",
  "updatedAt": "2026-03-24T20:00:00.000Z"
}
```

### GraphQL тип

```graphql
type User {
  id: ID!
  email: String!
  name: String
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Примечания

- `id` генерируется автоматически как UUID v4
- `email` валидируется и должен быть уникальным
- `name` пока не используется в системе, будет доступно для редактирования позже
- `createdAt` устанавливается автоматически при создании
- `updatedAt` обновляется автоматически при изменении

---

## AuthResponse - Ответ авторизации

Возвращается после успешной авторизации или обновления токенов.

### Поля

| Поле | Тип | Nullable | Описание |
|------|-----|----------|----------|
| accessToken | string (JWT) | Нет | JWT токен для авторизованных запросов |
| message | string | Нет | Сообщение о результате операции |

### Пример (JSON)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE2NDAzODQwMDAsImV4cCI6MTY0MDM4NDkwMH0.abcdefghijklmnopqrstuvwxyz",
  "message": "Успешная авторизация"
}
```

### GraphQL тип

```graphql
type AuthResponse {
  accessToken: String!
  message: String!
}
```

### Примечания

- `accessToken` действителен 15 минут
- JWT токен содержит payload: `{ sub: userId, email: userEmail }`
- Дополнительно устанавливается httpOnly cookie `refreshToken` (не включается в ответ)

---

## MessageResponse - Простой ответ с сообщением

Используется для операций, которые не возвращают данные.

### Поля

| Поле | Тип | Nullable | Описание |
|------|-----|----------|----------|
| message | string | Нет | Текстовое сообщение о результате операции |

### Пример (JSON)

```json
{
  "message": "Код отправлен на email"
}
```

### GraphQL тип

```graphql
type MessageResponse {
  message: String!
}
```

### Используется в:

- `POST /auth/send-code` - отправка кода
- `POST /auth/logout` - выход
- `mutation sendCode` - отправка кода
- `mutation logout` - выход

---

## SendCodeInput - Отправка кода верификации

Input тип для запроса кода верификации.

### Поля

| Поле | Тип | Обязательно | Валидация | Описание |
|------|-----|-------------|-----------|----------|
| email | string | Да | Валидный email | Email пользователя |

### Пример (JSON)

```json
{
  "email": "user@example.com"
}
```

### GraphQL тип

```graphql
input SendCodeInput {
  email: String!
}
```

### Валидация

- Email должен быть валидным (содержать @ и домен)
- Ошибка валидации: "Некорректный email"

---

## VerifyCodeInput - Верификация кода

Input тип для проверки кода верификации.

### Поля

| Поле | Тип | Обязательно | Валидация | Описание |
|------|-----|-------------|-----------|----------|
| email | string | Да | Валидный email | Email пользователя |
| code | string | Да | Ровно 4 символа | Код из email |

### Пример (JSON)

```json
{
  "email": "user@example.com",
  "code": "1234"
}
```

### GraphQL тип

```graphql
input VerifyCodeInput {
  email: String!
  code: String!
}
```

### Валидация

- Email должен быть валидным
- Code должен содержать ровно 4 символа
- Ошибки валидации:
  - "Некорректный email"
  - "Код должен содержать 4 цифры"

---

## DateTime - Дата и время

Скалярный тип для работы с датой и временем.

### Формат

ISO 8601 с timezone UTC

### Примеры

```
"2026-03-24T20:00:00.000Z"
"2026-01-15T09:30:15.123Z"
```

### GraphQL тип

```graphql
scalar DateTime
```

### Примечания

- Всегда возвращается в UTC (суффикс Z)
- Содержит миллисекунды
- При парсинге на фронтенде автоматически конвертируется в Date объект

---

## RefreshToken (Internal) - Refresh токен

**Внимание:** Этот тип хранится только в БД и не возвращается в API ответах.

### Поля (для справки)

| Поле | Тип | Описание |
|------|-----|----------|
| id | string (UUID) | ID токена |
| token | string | Случайная строка (64 байта hex) |
| userId | string (UUID) | ID пользователя |
| expiresAt | DateTime | Дата истечения (7 дней) |
| createdAt | DateTime | Дата создания |

### Примечания

- Хранится в httpOnly cookie с именем `refreshToken`
- Недоступен из JavaScript (безопасность)
- Автоматически отправляется браузером
- При обновлении токенов старый удаляется, создается новый

---

## VerificationCode (Internal) - Код верификации

**Внимание:** Этот тип хранится только в БД и не возвращается в API ответах.

### Поля (для справки)

| Поле | Тип | Описание |
|------|-----|----------|
| id | string (UUID) | ID кода |
| code | string | 4-значный код (1000-9999) |
| email | string | Email получателя |
| userId | string (UUID) | ID пользователя (nullable) |
| verified | boolean | Использован ли код |
| expiresAt | DateTime | Дата истечения (10 минут) |
| createdAt | DateTime | Дата создания |

### Примечания

- Код генерируется случайно (4 цифры от 1000 до 9999)
- Действителен 10 минут
- После использования помечается как `verified: true`
- При запросе нового кода старые становятся `verified: true`

---

## Error - Ошибка (REST API)

Формат ошибки для REST API.

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| statusCode | number | HTTP код ошибки |
| message | string \| string[] | Текст ошибки или массив ошибок |
| error | string | Название типа ошибки |

### Примеры

**Одна ошибка:**
```json
{
  "statusCode": 401,
  "message": "Неверный или истекший код",
  "error": "Unauthorized"
}
```

**Множественные ошибки валидации:**
```json
{
  "statusCode": 400,
  "message": [
    "Некорректный email",
    "Код должен содержать 4 цифры"
  ],
  "error": "Bad Request"
}
```

---

## Error - Ошибка (GraphQL)

Формат ошибки для GraphQL API.

### Структура

```json
{
  "errors": [
    {
      "message": "Неверный или истекший код",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

### Коды ошибок

| Код | Описание |
|-----|----------|
| UNAUTHENTICATED | Ошибка авторизации |
| BAD_USER_INPUT | Ошибка валидации |
| INTERNAL_SERVER_ERROR | Внутренняя ошибка сервера |

---

## Будущие типы

В разработке:

### Product - Продукт
```
id, name, description, price, images, category, stock, etc.
```

### Order - Заказ
```
id, userId, items, total, status, createdAt, etc.
```

### Cart - Корзина
```
id, userId, items, total, updatedAt, etc.
```

---

## См. также

- [Коды ошибок](./ERRORS.md)
- [REST API - Авторизация](../auth/AUTH-REST.md)
- [GraphQL API - Авторизация](../auth/AUTH-GRAPHQL.md)
