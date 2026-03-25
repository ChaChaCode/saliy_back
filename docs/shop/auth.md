# API авторизации

Авторизация по email с 4-значным кодом подтверждения.

---

## Эндпоинты

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

## Токены

### Access Token
- Время жизни: 15 минут
- Передаётся в заголовке: `Authorization: Bearer TOKEN`
- Используется для всех защищённых эндпоинтов

### Refresh Token
- Время жизни: 7 дней
- Хранится в httpOnly cookie
- Используется только для обновления access token

---

## Полный сценарий авторизации

```bash
# 1. Отправить код
curl -X POST https://saliy-shop.ru/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 2. Получить код из email

# 3. Подтвердить код
curl -X POST https://saliy-shop.ru/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "code": "1234"}'

# 4. Сохранить accessToken из ответа

# 5. Использовать токен для запросов
curl -X GET https://saliy-shop.ru/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 6. Когда токен истечёт, обновить его
curl -X POST https://saliy-shop.ru/api/auth/refresh \
  --cookie "refreshToken=..."

# 7. Выйти из системы
curl -X POST https://saliy-shop.ru/api/auth/logout \
  --cookie "refreshToken=..."
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные |
| 401 | Не авторизован |
| 500 | Ошибка сервера |
