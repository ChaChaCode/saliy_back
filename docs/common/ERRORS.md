# Коды ошибок и обработка ошибок

Полное описание всех возможных ошибок API и способов их обработки.

---

## HTTP коды ответов

| Код | Название | Описание |
|-----|----------|----------|
| 200 | OK | Успешный запрос |
| 400 | Bad Request | Неверные данные в запросе (ошибка валидации) |
| 401 | Unauthorized | Не авторизован (токен отсутствует/невалиден/истек) |
| 404 | Not Found | Ресурс не найден |
| 500 | Internal Server Error | Внутренняя ошибка сервера |

---

## Формат ошибок

### REST API

```json
{
  "statusCode": 400,
  "message": "Текст ошибки" | ["Ошибка 1", "Ошибка 2"],
  "error": "Bad Request"
}
```

**Поля:**
- `statusCode` - HTTP код ошибки
- `message` - строка или массив строк с описанием ошибки
- `error` - название типа ошибки

### GraphQL API

```json
{
  "errors": [
    {
      "message": "Текст ошибки",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

**Поля:**
- `errors` - массив ошибок
- `errors[].message` - текст ошибки
- `errors[].extensions.code` - код ошибки GraphQL
- `data` - null при ошибке

---

## Коды ошибок GraphQL

| Код | HTTP эквивалент | Описание |
|-----|-----------------|----------|
| UNAUTHENTICATED | 401 | Ошибка авторизации |
| BAD_USER_INPUT | 400 | Ошибка валидации входных данных |
| INTERNAL_SERVER_ERROR | 500 | Внутренняя ошибка сервера |

---

## Ошибки авторизации (401)

### 1. Access token отсутствует

**Когда возникает:**
- Запрос к защищенному endpoint без заголовка Authorization
- GET /auth/me без токена

**REST API:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Unauthorized",
    "extensions": { "code": "UNAUTHENTICATED" }
  }],
  "data": null
}
```

**Решение:**
- Добавить заголовок: `Authorization: Bearer <access_token>`
- Если токена нет - попробовать обновить через `/auth/refresh`
- Если refresh не помог - перенаправить на страницу входа

---

### 2. Access token невалиден или истек

**Когда возникает:**
- Токен поврежден
- Токен истек (прошло > 15 минут)
- Токен подписан неверным ключом

**REST API:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Unauthorized",
    "extensions": { "code": "UNAUTHENTICATED" }
  }],
  "data": null
}
```

**Решение:**
1. Попробовать обновить токен: `POST /auth/refresh`
2. Если успешно - сохранить новый access token и повторить запрос
3. Если refresh вернул 401 - перенаправить на страницу входа

---

### 3. Refresh token не найден

**Когда возникает:**
- Cookie `refreshToken` отсутствует при вызове `/auth/refresh`
- Cookies не отправляются (не настроен `credentials: 'include'`)

**REST API:**
```json
{
  "statusCode": 401,
  "message": "Refresh token не найден",
  "error": "Unauthorized"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Refresh token не найден",
    "extensions": { "code": "UNAUTHENTICATED" }
  }],
  "data": null
}
```

**Решение:**
- Проверить настройки клиента: `credentials: 'include'` или `withCredentials: true`
- Убедиться что домен правильно настроен для cookies
- Перенаправить на страницу входа

---

### 4. Refresh token недействителен

**Когда возникает:**
- Refresh token не найден в базе данных
- Refresh token истек (прошло > 7 дней)
- Refresh token был удален (пользователь вышел на другом устройстве)

**REST API:**
```json
{
  "statusCode": 401,
  "message": "Недействительный refresh token",
  "error": "Unauthorized"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Недействительный refresh token",
    "extensions": { "code": "UNAUTHENTICATED" }
  }],
  "data": null
}
```

**Решение:**
- Refresh token истек, необходима повторная авторизация
- Очистить состояние авторизации
- Перенаправить на страницу входа

---

### 5. Неверный или истекший код верификации

**Когда возникает:**
- Код введен неправильно
- Код истек (прошло > 10 минут)
- Код уже был использован
- Был запрошен новый код (старый стал недействительным)

**REST API:**
```json
{
  "statusCode": 401,
  "message": "Неверный или истекший код",
  "error": "Unauthorized"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Неверный или истекший код",
    "extensions": { "code": "UNAUTHENTICATED" }
  }],
  "data": null
}
```

**Решение:**
- Показать сообщение пользователю
- Предложить запросить новый код через `POST /auth/send-code`

---

## Ошибки валидации (400)

### 1. Некорректный email

**Когда возникает:**
- Email не соответствует формату (нет @ или домена)
- Email пустой

**REST API:**
```json
{
  "statusCode": 400,
  "message": "Некорректный email",
  "error": "Bad Request"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Validation error",
    "extensions": { "code": "BAD_USER_INPUT" }
  }],
  "data": null
}
```

**Решение:**
- Валидировать email на клиенте перед отправкой
- Показать сообщение об ошибке пользователю

---

### 2. Слишком частая отправка кода

**Когда возникает:**
- Попытка повторно запросить код менее чем через 1 минуту после предыдущей отправки

**REST API:**
```json
{
  "statusCode": 400,
  "message": "Код уже был отправлен. Повторная отправка возможна через 45 секунд",
  "error": "Bad Request"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Код уже был отправлен. Повторная отправка возможна через 45 секунд",
    "extensions": { "code": "BAD_USER_INPUT" }
  }],
  "data": null
}
```

**Решение:**
- Извлечь количество секунд из сообщения (регулярное выражение)
- Показать таймер обратного отсчета пользователю
- Заблокировать кнопку "Отправить код повторно" на указанное время
- После истечения времени разблокировать кнопку

**Пример обработки на клиенте:**
```javascript
const match = error.message.match(/через (\d+) секунд/);
if (match) {
  const secondsLeft = parseInt(match[1]);
  // Запустить таймер на secondsLeft секунд
  startCountdown(secondsLeft);
}
```

---

### 3. Неверный формат кода

**Когда возникает:**
- Код содержит не 4 символа
- Код пустой

**REST API:**
```json
{
  "statusCode": 400,
  "message": "Код должен содержать 4 цифры",
  "error": "Bad Request"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Validation error",
    "extensions": { "code": "BAD_USER_INPUT" }
  }],
  "data": null
}
```

**Решение:**
- Валидировать длину кода на клиенте
- Ограничить ввод 4 символами: `maxLength={4}`
- Показать сообщение об ошибке

---

### 4. Множественные ошибки валидации

**Когда возникает:**
- Несколько полей не прошли валидацию одновременно

**REST API:**
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

**Решение:**
- Показать все ошибки пользователю
- Проверить, что `message` - это массив

---

## Ошибки сервера (500)

### Internal Server Error

**Когда возникает:**
- Ошибка при отправке email
- Ошибка базы данных
- Непредвиденная ошибка

**REST API:**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

**GraphQL API:**
```json
{
  "errors": [{
    "message": "Internal server error",
    "extensions": { "code": "INTERNAL_SERVER_ERROR" }
  }],
  "data": null
}
```

**Решение:**
- Показать общее сообщение об ошибке пользователю
- Предложить повторить попытку
- Логировать ошибку для анализа

---

## Обработка ошибок на клиенте

### Fetch API

```javascript
try {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json();

    switch (response.status) {
      case 400:
        // Ошибка валидации
        handleValidationError(error.message);
        break;
      case 401:
        // Не авторизован - попробовать обновить токен
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Повторить запрос
          return fetch(url, options);
        } else {
          // Перенаправить на вход
          redirectToLogin();
        }
        break;
      case 500:
        // Ошибка сервера
        showErrorMessage('Произошла ошибка, попробуйте позже');
        break;
      default:
        showErrorMessage('Неизвестная ошибка');
    }

    throw new Error(error.message);
  }

  return await response.json();
} catch (error) {
  console.error('Request failed:', error);
  throw error;
}
```

---

### Axios

```javascript
import axios from 'axios';

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          // Ошибка валидации
          const message = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message;
          showValidationError(message);
          break;

        case 401:
          // Не авторизован
          if (!error.config._retry) {
            error.config._retry = true;

            try {
              await refreshAccessToken();
              return api(error.config); // Повторить запрос
            } catch (refreshError) {
              redirectToLogin();
            }
          }
          break;

        case 500:
          showErrorMessage('Ошибка сервера, попробуйте позже');
          break;
      }
    }

    return Promise.reject(error);
  }
);
```

---

### Apollo Client (GraphQL)

```javascript
import { ApolloClient, ApolloLink, HttpLink } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      const code = extensions?.code;

      switch (code) {
        case 'UNAUTHENTICATED':
          // Не авторизован - обновить токен
          refreshAccessToken().catch(() => redirectToLogin());
          break;

        case 'BAD_USER_INPUT':
          // Ошибка валидации
          showValidationError(message);
          break;

        case 'INTERNAL_SERVER_ERROR':
          // Ошибка сервера
          showErrorMessage('Ошибка сервера');
          break;
      }
    });
  }

  if (networkError) {
    console.error('Network error:', networkError);
    showErrorMessage('Ошибка сети');
  }
});

const client = new ApolloClient({
  link: ApolloLink.from([errorLink, httpLink]),
  cache: new InMemoryCache(),
});
```

---

## Рекомендации по UX

### Сообщения для пользователя

| Ошибка | Сообщение пользователю |
|--------|------------------------|
| Некорректный email | "Пожалуйста, введите корректный email" |
| Код должен содержать 4 цифры | "Код должен состоять из 4 цифр" |
| Неверный или истекший код | "Код неверный или истек. Запросите новый код" |
| Refresh token не найден | "Сессия истекла. Пожалуйста, войдите снова" |
| Internal server error | "Произошла ошибка. Пожалуйста, попробуйте позже" |

### Автоматические действия

- **401 при запросе к API** → Автоматически попробовать обновить токен
- **401 при refresh** → Перенаправить на страницу входа
- **500** → Показать сообщение, предложить повторить
- **400** → Выделить поля с ошибками, показать подсказки

---

## Дебаг ошибок

### Включить отладку в браузере

1. Открыть DevTools (F12)
2. Перейти в Network
3. Найти failed запрос
4. Проверить:
   - Request Headers (Authorization, Cookie)
   - Response Status
   - Response Body
   - Request Payload

### Типичные проблемы

| Проблема | Причина | Решение |
|----------|---------|---------|
| Cookies не отправляются | Не указан credentials: 'include' | Добавить в настройки клиента |
| CORS error | Домен не в списке разрешенных | Проверить backend CORS настройки |
| 401 на все запросы | Токен не добавляется | Проверить interceptor/middleware |
| Бесконечный цикл refresh | Нет проверки _retry флага | Добавить проверку в interceptor |

---

## См. также

- [Типы данных](./TYPES.md)
- [REST API - Авторизация](../auth/AUTH-REST.md)
- [GraphQL API - Авторизация](../auth/AUTH-GRAPHQL.md)
- [Гайд по интеграции](../auth/AUTH-INTEGRATION.md)
