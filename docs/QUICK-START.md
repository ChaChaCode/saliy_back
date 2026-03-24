# Быстрый старт для фронтенд-разработчиков

## Базовая информация

**API URL:** `https://api.saliy-shop.ru`
**GraphQL Playground:** `https://api.saliy-shop.ru/graphql`

---

## Аутентификация: Как это работает

### Токены

1. **Access Token** (15 минут)
   - Получаете после успешной авторизации
   - Передаете в заголовке: `Authorization: Bearer <token>`
   - Хранить в памяти приложения (React Context/Redux)

2. **Refresh Token** (7 дней)
   - Автоматически сохраняется в httpOnly cookie
   - Используется для обновления access token
   - Не доступен из JavaScript (безопасность)

### Важно для настройки клиента

Обязательно включите отправку cookies:

**Fetch:**
```javascript
fetch(url, {
  credentials: 'include'
})
```

**Axios:**
```javascript
axios.defaults.withCredentials = true;
```

**Apollo Client:**
```javascript
new ApolloClient({
  credentials: 'include'
})
```

---

## Процесс авторизации (пошагово)

### Шаг 1: Отправка кода на email

**REST:**
```
POST https://api.saliy-shop.ru/auth/send-code
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**GraphQL:**
```graphql
mutation {
  sendCode(input: { email: "user@example.com" }) {
    message
  }
}
```

**Ответ:**
```json
{
  "message": "Код отправлен на email"
}
```

---

### Шаг 2: Верификация кода (вход)

Пользователь получает на email 4-значный код (например: 1234)

**REST:**
```
POST https://api.saliy-shop.ru/auth/verify-code
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "1234"
}
```

**GraphQL:**
```graphql
mutation {
  verifyCode(input: {
    email: "user@example.com",
    code: "1234"
  }) {
    accessToken
    message
  }
}
```

**Ответ:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Успешная авторизация"
}
```

**Что происходит:**
- Получаете `accessToken` - сохраните в памяти
- Cookie `refreshToken` устанавливается автоматически

---

### Шаг 3: Получение профиля пользователя

**REST:**
```
GET https://api.saliy-shop.ru/auth/me
Authorization: Bearer <accessToken>
```

**GraphQL:**
```graphql
query {
  me {
    id
    email
    name
    createdAt
    updatedAt
  }
}
# Добавить заголовок: Authorization: Bearer <accessToken>
```

**Ответ:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": null,
  "createdAt": "2026-03-24T20:00:00.000Z",
  "updatedAt": "2026-03-24T20:00:00.000Z"
}
```

---

### Шаг 4: Обновление токена (когда истек access token)

**REST:**
```
POST https://api.saliy-shop.ru/auth/refresh
Content-Type: application/json
```

**GraphQL:**
```graphql
mutation {
  refreshToken {
    accessToken
    message
  }
}
```

**Ответ:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Токен обновлен"
}
```

**Что происходит:**
- Получаете новый `accessToken`
- Cookie `refreshToken` автоматически обновляется

---

### Шаг 5: Выход

**REST:**
```
POST https://api.saliy-shop.ru/auth/logout
```

**GraphQL:**
```graphql
mutation {
  logout {
    message
  }
}
```

**Ответ:**
```json
{
  "message": "Выход выполнен"
}
```

**Что происходит:**
- Refresh token удаляется из базы
- Cookie `refreshToken` очищается
- Удалите access token из памяти приложения

---

## Обработка ошибки 401 (токен истек)

### Логика автоматического обновления токена

```
1. Делаете запрос с access token
2. Получаете 401 Unauthorized
3. Вызываете POST /auth/refresh
4. Получаете новый access token
5. Повторяете исходный запрос с новым токеном
6. Если refresh тоже вернул 401 → перенаправить на страницу входа
```

---

## Проверка авторизации при загрузке приложения

```
1. Проверить, есть ли access token в памяти
2. Если есть - вызвать GET /auth/me
3. Если успешно - пользователь авторизован
4. Если 401:
   a. Вызвать POST /auth/refresh
   b. Если успешно - сохранить новый access token и вызвать /auth/me снова
   c. Если 401 - пользователь не авторизован (показать форму входа)
5. Если токена нет - показать форму входа
```

---

## Типичные ошибки и их решения

### Ошибка: "Refresh token не найден"

**Причина:** Cookie не отправляется с запросом

**Решение:** Добавить `credentials: 'include'` в настройки клиента

---

### Ошибка: "Некорректный email"

**Причина:** Email не прошел валидацию

**Решение:** Проверить формат email (должен содержать @ и домен)

---

### Ошибка: "Код должен содержать 4 цифры"

**Причина:** Код неправильной длины

**Решение:** Код должен быть ровно 4 символа (например: "1234", не "123" или "12345")

---

### Ошибка: "Неверный или истекший код"

**Причины:**
- Код введен неправильно
- Прошло больше 10 минут с момента отправки
- Код уже был использован
- Был запрошен новый код (старый стал недействительным)

**Решение:** Запросить новый код через `POST /auth/send-code`

---

## Данные пользователя (User)

| Поле | Тип | Nullable | Описание |
|------|-----|----------|----------|
| id | string | Нет | UUID пользователя |
| email | string | Нет | Email пользователя |
| name | string | Да | Имя пользователя (может быть null) |
| createdAt | string | Нет | Дата создания (ISO 8601 формат) |
| updatedAt | string | Нет | Дата последнего обновления (ISO 8601) |

**Пример:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": null,
  "createdAt": "2026-03-24T20:00:00.000Z",
  "updatedAt": "2026-03-24T20:00:00.000Z"
}
```

---

## REST vs GraphQL - что использовать?

### Используйте REST, если:
- Простые операции (вход, выход)
- Не нужна гибкость в выборе полей
- Проще интегрировать

### Используйте GraphQL, если:
- Нужна гибкость в выборе полей
- Уже используете Apollo Client
- Хотите минимизировать количество запросов
- Нужен типизированный API

**Оба варианта работают одинаково - выбирайте что удобнее!**

---

## Тестирование в браузере

### REST API (Postman / Insomnia)

1. Импортировать endpoints из документации
2. Настроить `credentials: include` или включить отправку cookies
3. Тестировать запросы

### GraphQL (Playground)

1. Открыть https://api.saliy-shop.ru/graphql
2. Включить "Request Credentials" в настройках (шестеренка)
3. Писать и тестировать запросы визуально

---

## Чек-лист интеграции

- [ ] Настроить отправку cookies (`credentials: 'include'`)
- [ ] Реализовать хранение access token в памяти (не в localStorage!)
- [ ] Добавить interceptor/middleware для автоматического обновления токена при 401
- [ ] Реализовать проверку авторизации при загрузке приложения
- [ ] Добавить форму входа (email → код → авторизация)
- [ ] Добавить кнопку выхода с вызовом `/auth/logout`
- [ ] Обрабатывать ошибки валидации (400)
- [ ] Показывать понятные сообщения об ошибках пользователю
- [ ] Тестировать в production окружении (HTTPS обязателен для cookies!)

---

## Полезные ссылки

- [Полная документация API](./API-DOCUMENTATION.md)
- [GraphQL Playground](https://api.saliy-shop.ru/graphql)
- [Production API](https://api.saliy-shop.ru)

---

## Нужна помощь?

Если что-то не работает:

1. Проверьте, что `credentials: 'include'` включен
2. Проверьте формат данных в запросе
3. Проверьте заголовок Authorization для защищенных endpoints
4. Посмотрите вкладку Network в DevTools браузера
5. Обратитесь к backend разработчику

**Happy coding! 🚀**
