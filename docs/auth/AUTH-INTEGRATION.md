# Гайд по интеграции авторизации

Пошаговое руководство по подключению авторизации к вашему фронтенд приложению.

---

## Основные концепции

### Токены

1. **Access Token**
   - Короткий JWT токен (15 минут)
   - Используется для авторизованных запросов
   - Передается в заголовке `Authorization: Bearer <token>`
   - Хранить в памяти приложения (Context/Redux/Zustand)
   - **НЕ** хранить в localStorage (угроза XSS)

2. **Refresh Token**
   - Длинный случайный токен (7 дней)
   - Хранится в httpOnly cookie (недоступен из JavaScript)
   - Используется для обновления access token
   - Автоматически отправляется браузером

### Зачем два токена?

- Access token короткий = меньше риск при компрометации
- Refresh token в httpOnly cookie = защита от XSS атак
- Если access token украден, он действует только 15 минут
- Если refresh token украден, злоумышленник не может его прочитать из JavaScript

---

## Шаг 1: Настройка HTTP клиента

### Для Fetch API

```javascript
const API_URL = 'https://api.saliy-shop.ru';

const fetchWithCredentials = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include', // Отправка cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
};
```

### Для Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.saliy-shop.ru',
  withCredentials: true, // Отправка cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

### Для Apollo Client (GraphQL)

```javascript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'https://api.saliy-shop.ru/graphql',
  credentials: 'include', // Отправка cookies
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken'); // Пример
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

---

## Шаг 2: Создание Auth Context (React)

```javascript
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Проверка авторизации при загрузке
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Попытка получить профиль
      const response = await fetch('https://api.saliy-shop.ru/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else if (response.status === 401) {
        // Access token истек, пробуем обновить
        await refreshAccessToken();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAccessToken = async () => {
    try {
      const response = await fetch('https://api.saliy-shop.ru/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.accessToken);
        // Повторно получаем профиль
        await checkAuth();
        return data.accessToken;
      } else {
        // Refresh token истек
        setUser(null);
        setAccessToken(null);
        return null;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  };

  const sendCode = async (email) => {
    const response = await fetch('https://api.saliy-shop.ru/auth/send-code', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  };

  const verifyCode = async (email, code) => {
    const response = await fetch('https://api.saliy-shop.ru/auth/verify-code', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    setAccessToken(data.accessToken);

    // Получаем профиль пользователя
    await checkAuth();

    return data;
  };

  const logout = async () => {
    try {
      await fetch('https://api.saliy-shop.ru/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  const value = {
    user,
    accessToken,
    loading,
    sendCode,
    verifyCode,
    logout,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

## Шаг 3: Axios Interceptor для автоматического обновления токенов

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.saliy-shop.ru',
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

// Request interceptor - добавляем access token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken(); // Ваша функция получения токена
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - обрабатываем 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если 401 и это не запрос refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Ждем обновления токена
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        const newToken = data.accessToken;

        setAccessToken(newToken); // Ваша функция сохранения токена

        isRefreshing = false;
        onTokenRefreshed(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        // Refresh token тоже истек - перенаправляем на вход
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## Шаг 4: Компонент формы входа (React)

```javascript
import { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

export const LoginForm = () => {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { sendCode, verifyCode } = useAuth();
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendCode(email);
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyCode(email, code);
      navigate('/dashboard'); // Перенаправляем после успешного входа
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'email') {
    return (
      <form onSubmit={handleSendCode}>
        <h2>Вход</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Отправка...' : 'Получить код'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode}>
      <h2>Введите код из email</h2>
      <p>Код отправлен на {email}</p>
      <input
        type="text"
        placeholder="1234"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={4}
        pattern="[0-9]{4}"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Проверка...' : 'Войти'}
      </button>
      <button type="button" onClick={() => setStep('email')}>
        Изменить email
      </button>
    </form>
  );
};
```

---

## Шаг 5: Защищенный роут (React Router)

```javascript
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Использование:
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

---

## Полный flow авторизации

### 1. Вход пользователя

```
Пользователь → Вводит email → Нажимает "Получить код"
    ↓
Frontend → POST /auth/send-code { email }
    ↓
Backend → Отправляет код на email
    ↓
Frontend → Показывает поле для ввода кода
    ↓
Пользователь → Вводит код из email
    ↓
Frontend → POST /auth/verify-code { email, code }
    ↓
Backend → Проверяет код, возвращает accessToken, устанавливает cookie refreshToken
    ↓
Frontend → Сохраняет accessToken в памяти, получает профиль пользователя
    ↓
Пользователь авторизован ✅
```

### 2. Проверка авторизации при загрузке приложения

```
Приложение загружается
    ↓
Frontend → GET /auth/me (с accessToken если есть)
    ↓
Успех? → Пользователь авторизован ✅
    ↓
401? → POST /auth/refresh
    ↓
Успех? → Сохранить новый accessToken → GET /auth/me → Авторизован ✅
    ↓
401? → Показать форму входа
```

### 3. Автоматическое обновление токена

```
Frontend → Запрос к защищенному endpoint с accessToken
    ↓
200? → Обработать ответ ✅
    ↓
401? → POST /auth/refresh
    ↓
Успех? → Сохранить новый accessToken → Повторить исходный запрос ✅
    ↓
401? → Refresh token истек → Перенаправить на /login
```

### 4. Выход

```
Пользователь → Нажимает "Выйти"
    ↓
Frontend → POST /auth/logout
    ↓
Backend → Удаляет refreshToken из БД, очищает cookie
    ↓
Frontend → Удаляет accessToken из памяти, перенаправляет на /login
```

---

## Чек-лист интеграции

- [ ] Настроен HTTP клиент с `credentials: 'include'`
- [ ] Создан Auth Context/Store для управления состоянием
- [ ] Реализовано хранение accessToken в памяти (НЕ в localStorage)
- [ ] Добавлен interceptor для автоматического обновления токена при 401
- [ ] Реализована проверка авторизации при загрузке приложения
- [ ] Создана форма входа (email → код → авторизация)
- [ ] Добавлены защищенные роуты
- [ ] Добавлена кнопка выхода с вызовом `/auth/logout`
- [ ] Обрабатываются все ошибки валидации (400)
- [ ] Показываются понятные сообщения об ошибках
- [ ] Протестировано в production (HTTPS!)

---

## Частые ошибки

### 1. Cookies не отправляются

**Причина:** Не указан `credentials: 'include'`

**Решение:**
```javascript
fetch(url, { credentials: 'include' })
// или
axios.defaults.withCredentials = true
```

### 2. CORS ошибка

**Причина:** Backend не настроен на ваш домен

**Решение:** Проверить что ваш домен в списке разрешенных CORS origins на backend

### 3. Токен не обновляется автоматически

**Причина:** Нет interceptor для обработки 401

**Решение:** Добавить interceptor как в примере выше

### 4. Бесконечный цикл обновления токенов

**Причина:** Запрос refresh тоже возвращает 401

**Решение:** Проверять `originalRequest._retry` флаг и перенаправлять на login при ошибке refresh

---

## Безопасность

### Что делать ✅

- Хранить accessToken в памяти приложения (Context/Redux)
- Использовать HTTPS в production
- Передавать accessToken только в заголовке Authorization
- Проверять истечение токена и обновлять заранее
- Вызывать logout при выходе

### Что НЕ делать ❌

- Хранить accessToken в localStorage (уязвимо к XSS)
- Отправлять токены в URL параметрах
- Хранить пароли на клиенте
- Игнорировать ошибки авторизации

---

## Тестирование

### Сценарии для тестирования:

1. ✅ Вход нового пользователя
2. ✅ Вход существующего пользователя
3. ✅ Неверный код верификации
4. ✅ Истекший код (10+ минут)
5. ✅ Обновление токена при истечении accessToken
6. ✅ Загрузка приложения с валидным refreshToken
7. ✅ Загрузка приложения с истекшим refreshToken
8. ✅ Выход из системы
9. ✅ Защищенные роуты без авторизации
10. ✅ Несколько вкладок браузера (синхронизация состояния)

---

## См. также

- [REST API](./AUTH-REST.md)
- [GraphQL API](./AUTH-GRAPHQL.md)
- [Типы данных](../common/TYPES.md)
- [Коды ошибок](../common/ERRORS.md)
