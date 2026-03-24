# GraphQL API - Аутентификация

Документация GraphQL API для модуля авторизации.

**Endpoint:** `https://api.saliy-shop.ru/graphql`
**Playground:** `https://api.saliy-shop.ru/graphql` (открыть в браузере)

---

## Типы данных GraphQL

### User
```graphql
type User {
  id: ID!
  email: String!
  name: String
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### AuthResponse
```graphql
type AuthResponse {
  accessToken: String!
  message: String!
}
```

### MessageResponse
```graphql
type MessageResponse {
  message: String!
}
```

### SendCodeInput
```graphql
input SendCodeInput {
  email: String!
}
```

### VerifyCodeInput
```graphql
input VerifyCodeInput {
  email: String!
  code: String!
}
```

### DateTime
```graphql
scalar DateTime
```
Формат: ISO 8601 (например: "2026-03-24T20:00:00.000Z")

---

## Queries (Запросы)

### me - Получить текущего пользователя

Возвращает информацию о текущем авторизованном пользователе.

**Требует авторизации:** Да (Bearer token)

**Запрос:**
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
```

**Заголовки:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Успешный ответ:**
```json
{
  "data": {
    "me": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": null,
      "createdAt": "2026-03-24T20:00:00.000Z",
      "updatedAt": "2026-03-24T20:00:00.000Z"
    }
  }
}
```

**Возможные ошибки:**
```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

**Примечания:**
- Требуется валидный access token
- Используется для проверки авторизации
- Если получили UNAUTHENTICATED, нужно обновить токен

---

## Mutations (Мутации)

### sendCode - Отправить код верификации

Отправляет 4-значный код верификации на email.

**Требует авторизации:** Нет

**Запрос:**
```graphql
mutation {
  sendCode(input: { email: "user@example.com" }) {
    message
  }
}
```

**Параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| email | String! | Да | Email пользователя (валидный) |

**Успешный ответ:**
```json
{
  "data": {
    "sendCode": {
      "message": "Код отправлен на email"
    }
  }
}
```

**Возможные ошибки:**
```json
{
  "errors": [
    {
      "message": "Validation error",
      "extensions": {
        "code": "BAD_USER_INPUT"
      }
    }
  ],
  "data": null
}
```

**Примечания:**
- Код действителен **10 минут**
- Старые коды становятся недействительными
- Код состоит из **4 цифр** (1000-9999)

---

### verifyCode - Верификация кода

Проверяет код верификации и авторизует пользователя.

**Требует авторизации:** Нет

**Запрос:**
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

**Параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| email | String! | Да | Email пользователя |
| code | String! | Да | 4-значный код из email |

**Успешный ответ:**
```json
{
  "data": {
    "verifyCode": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "Успешная авторизация"
    }
  }
}
```

**Дополнительно:**
- Устанавливается cookie `refreshToken` (httpOnly, 7 дней)

**Возможные ошибки:**

Неверный код:
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

Ошибка валидации:
```json
{
  "errors": [
    {
      "message": "Validation error",
      "extensions": {
        "code": "BAD_USER_INPUT"
      }
    }
  ],
  "data": null
}
```

**Примечания:**
- Если пользователь не существует, создается автоматически
- Код становится недействительным после использования
- Access token действителен **15 минут**
- Refresh token действителен **7 дней**

---

### refreshToken - Обновить токены

Обновляет access token используя refresh token из cookie.

**Требует авторизации:** Нет (но нужен refresh token в cookie)

**Запрос:**
```graphql
mutation {
  refreshToken {
    accessToken
    message
  }
}
```

**Требования:**
- Cookie `refreshToken` должен присутствовать
- Необходимо отправлять запрос с `credentials: 'include'`

**Успешный ответ:**
```json
{
  "data": {
    "refreshToken": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "Токен обновлен"
    }
  }
}
```

**Дополнительно:**
- Обновляется cookie `refreshToken` с новым значением

**Возможные ошибки:**

Refresh token отсутствует:
```json
{
  "errors": [
    {
      "message": "Refresh token не найден",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

Refresh token недействителен:
```json
{
  "errors": [
    {
      "message": "Недействительный refresh token",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

**Примечания:**
- Старый refresh token удаляется из БД
- Выдается новая пара токенов
- Если refresh token истек, нужна повторная авторизация

---

### logout - Выход из системы

Удаляет refresh token и завершает сессию.

**Требует авторизации:** Нет

**Запрос:**
```graphql
mutation {
  logout {
    message
  }
}
```

**Успешный ответ:**
```json
{
  "data": {
    "logout": {
      "message": "Выход выполнен"
    }
  }
}
```

**Дополнительно:**
- Удаляется cookie `refreshToken`

**Возможные ошибки:**
Не возвращает ошибок, даже если refresh token отсутствует.

**Примечания:**
- Refresh token удаляется из БД (если существует)
- Cookie очищается
- Безопасный выход без ошибок

---

## Настройка GraphQL клиента

### Apollo Client

```javascript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'https://api.saliy-shop.ru/graphql',
  credentials: 'include', // Важно для cookies
});

const authLink = setContext((_, { headers }) => {
  const token = getAccessToken(); // Ваша функция получения токена
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

### urql

```javascript
import { createClient, fetchExchange } from 'urql';
import { authExchange } from '@urql/exchange-auth';

const client = createClient({
  url: 'https://api.saliy-shop.ru/graphql',
  fetchOptions: {
    credentials: 'include', // Важно для cookies
  },
  exchanges: [
    // ... настройка authExchange для автоматического обновления токенов
    fetchExchange,
  ],
});
```

---

## Примеры запросов

### Через fetch API

**Query:**
```javascript
fetch('https://api.saliy-shop.ru/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  credentials: 'include', // Важно для cookies
  body: JSON.stringify({
    query: `
      query {
        me {
          id
          email
          name
        }
      }
    `
  }),
})
.then(res => res.json())
.then(data => console.log(data));
```

**Mutation:**
```javascript
fetch('https://api.saliy-shop.ru/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({
    query: `
      mutation SendCode($email: String!) {
        sendCode(input: { email: $email }) {
          message
        }
      }
    `,
    variables: {
      email: 'user@example.com'
    }
  }),
})
.then(res => res.json())
.then(data => console.log(data));
```

---

### Через curl

**Query:**
```bash
curl -X POST https://api.saliy-shop.ru/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  --cookie "refreshToken=YOUR_REFRESH_TOKEN" \
  -d '{
    "query": "{ me { id email } }"
  }'
```

**Mutation:**
```bash
curl -X POST https://api.saliy-shop.ru/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { sendCode(input: { email: \"test@example.com\" }) { message } }"
  }'
```

---

## GraphQL Playground

Для тестирования API откройте в браузере:
**https://api.saliy-shop.ru/graphql**

### Настройка Playground для работы с cookies:

1. Откройте Playground
2. Нажмите на иконку шестеренки (Settings)
3. Включите опцию **"request.credentials": "include"**
4. Теперь Playground будет отправлять cookies

### Добавление Authorization заголовка:

В нижней части Playground в разделе "HTTP HEADERS":
```json
{
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

---

## Introspection Query

Получить полную схему API:

```graphql
{
  __schema {
    types {
      name
      kind
      description
    }
    queryType {
      name
      fields {
        name
        description
      }
    }
    mutationType {
      name
      fields {
        name
        description
      }
    }
  }
}
```

---

## Коды ошибок GraphQL

| Код | Описание |
|-----|----------|
| UNAUTHENTICATED | Не авторизован (токен отсутствует/невалиден) |
| BAD_USER_INPUT | Неверные данные в запросе (валидация) |
| INTERNAL_SERVER_ERROR | Внутренняя ошибка сервера |

---

## См. также

- [REST API для авторизации](./AUTH-REST.md)
- [Гайд по интеграции](./AUTH-INTEGRATION.md)
- [Типы данных](../common/TYPES.md)
- [Коды ошибок](../common/ERRORS.md)
