# REST API - Аутентификация

Документация REST endpoints для модуля авторизации.

**Base URL:** `https://api.saliy-shop.ru`

---

## Endpoints

### 1. Отправка кода верификации

Отправляет 4-значный код верификации на email пользователя.

**Endpoint:** `POST /auth/send-code`

**Заголовки:**
```
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "email": "user@example.com"
}
```

**Параметры:**
| Поле | Тип | Обязательно | Валидация | Описание |
|------|-----|-------------|-----------|----------|
| email | string | Да | Валидный email | Email пользователя |

**Успешный ответ (200 OK):**
```json
{
  "message": "Код отправлен на email"
}
```

**Возможные ошибки:**

**400 Bad Request** - невалидные данные
```json
{
  "statusCode": 400,
  "message": "Некорректный email",
  "error": "Bad Request"
}
```

**400 Bad Request** - попытка повторной отправки слишком рано
```json
{
  "statusCode": 400,
  "message": "Код уже был отправлен. Повторная отправка возможна через 45 секунд",
  "error": "Bad Request"
}
```

**500 Internal Server Error** - ошибка отправки email
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

**Примечания:**
- Код действителен **10 минут**
- **Повторная отправка кода возможна через 1 минуту** после предыдущей отправки (защита от спама)
- Если запросить новый код, старые коды становятся недействительными
- Код состоит из **4 цифр** (от 1000 до 9999)

---

### 2. Верификация кода и авторизация

Проверяет код верификации и авторизует пользователя.

**Endpoint:** `POST /auth/verify-code`

**Заголовки:**
```
Content-Type: application/json
```

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "code": "1234"
}
```

**Параметры:**
| Поле | Тип | Обязательно | Валидация | Описание |
|------|-----|-------------|-----------|----------|
| email | string | Да | Валидный email | Email пользователя |
| code | string | Да | Ровно 4 символа | Код из email |

**Успешный ответ (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Успешная авторизация"
}
```

**Дополнительно:**
- Устанавливается cookie `refreshToken`:
  - `httpOnly: true`
  - `secure: true` (только HTTPS)
  - `sameSite: lax`
  - `maxAge: 7 дней`
  - `path: /`

**Возможные ошибки:**

**400 Bad Request** - невалидные данные
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

**401 Unauthorized** - неверный или истекший код
```json
{
  "statusCode": 401,
  "message": "Неверный или истекший код",
  "error": "Unauthorized"
}
```

**Примечания:**
- Если пользователя с таким email не существует, он создается автоматически
- После успешной верификации код становится недействительным
- Access token действителен **15 минут**
- Refresh token действителен **7 дней**

---

### 3. Обновление токенов

Обновляет access token используя refresh token из cookie.

**Endpoint:** `POST /auth/refresh`

**Заголовки:**
```
Content-Type: application/json
Cookie: refreshToken=<token>
```

**Тело запроса:**
Пустое (refresh token берется из cookie)

**Требования:**
- Cookie `refreshToken` должен присутствовать
- Необходимо отправлять запрос с `credentials: 'include'`

**Успешный ответ (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Токен обновлен"
}
```

**Дополнительно:**
- Обновляется cookie `refreshToken` с новым значением (те же параметры)

**Возможные ошибки:**

**401 Unauthorized** - refresh token отсутствует
```json
{
  "statusCode": 401,
  "message": "Refresh token не найден",
  "error": "Unauthorized"
}
```

**401 Unauthorized** - refresh token недействителен
```json
{
  "statusCode": 401,
  "message": "Недействительный refresh token",
  "error": "Unauthorized"
}
```

**Примечания:**
- Старый refresh token удаляется из базы данных
- Выдается новая пара токенов (access + refresh)
- Если refresh token истек, нужна повторная авторизация

---

### 4. Выход из системы

Удаляет refresh token и завершает сессию.

**Endpoint:** `POST /auth/logout`

**Заголовки:**
```
Content-Type: application/json
Cookie: refreshToken=<token>
```

**Тело запроса:**
Пустое

**Успешный ответ (200 OK):**
```json
{
  "message": "Выход выполнен"
}
```

**Дополнительно:**
- Удаляется cookie `refreshToken`

**Возможные ошибки:**

Endpoint не возвращает ошибок, даже если refresh token отсутствует.

**Примечания:**
- Refresh token удаляется из базы данных (если существует)
- Cookie `refreshToken` очищается
- Можно вызывать даже без refresh token (безопасный выход)

---

### 5. Получение профиля текущего пользователя

Возвращает информацию о текущем авторизованном пользователе.

**Endpoint:** `GET /auth/me`

**Заголовки:**
```
Authorization: Bearer <access_token>
```

**Тело запроса:**
Не требуется

**Требования:**
- Валидный access token в заголовке Authorization

**Успешный ответ (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": null,
  "createdAt": "2026-03-24T20:00:00.000Z",
  "updatedAt": "2026-03-24T20:00:00.000Z"
}
```

**Возвращаемые поля:**
| Поле | Тип | Nullable | Описание |
|------|-----|----------|----------|
| id | string | Нет | UUID пользователя |
| email | string | Нет | Email пользователя |
| name | string | Да | Имя пользователя |
| createdAt | string | Нет | Дата создания (ISO 8601) |
| updatedAt | string | Нет | Дата обновления (ISO 8601) |

**Возможные ошибки:**

**401 Unauthorized** - токен отсутствует
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**401 Unauthorized** - токен невалиден или истек
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Примечания:**
- Используется для проверки авторизации
- Если получили 401, нужно обновить токен через `/auth/refresh`

---

## Общие HTTP коды

| Код | Описание |
|-----|----------|
| 200 | Успешный запрос |
| 400 | Неверные данные в запросе (валидация не прошла) |
| 401 | Не авторизован (отсутствует или невалидный токен) |
| 500 | Внутренняя ошибка сервера |

---

## Формат ошибок

Все ошибки возвращаются в формате:

```json
{
  "statusCode": 400,
  "message": "Описание ошибки" | ["Ошибка 1", "Ошибка 2"],
  "error": "Bad Request"
}
```

- `message` может быть строкой или массивом строк (при множественных ошибках валидации)

---

## Примеры curl

### Отправка кода
```bash
curl -X POST https://api.saliy-shop.ru/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Верификация кода
```bash
curl -X POST https://api.saliy-shop.ru/auth/verify-code \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "test@example.com", "code": "1234"}'
```

### Получить профиль
```bash
curl https://api.saliy-shop.ru/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Обновить токен
```bash
curl -X POST https://api.saliy-shop.ru/auth/refresh \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -c cookies.txt
```

### Выход
```bash
curl -X POST https://api.saliy-shop.ru/auth/logout \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

---

## См. также

- [GraphQL API для авторизации](./AUTH-GRAPHQL.md)
- [Гайд по интеграции](./AUTH-INTEGRATION.md)
- [Типы данных](../common/TYPES.md)
- [Коды ошибок](../common/ERRORS.md)
