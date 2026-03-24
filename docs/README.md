# API Документация Saliy Shop

Добро пожаловать в документацию API для фронтенд-разработчиков.

## Базовая информация

**Production API:** `https://saliy-shop.ru/api`
**GraphQL Playground:** `https://saliy-shop.ru/api/graphql`
**API Version:** 0.0.1

---

## Быстрый старт

**Для быстрого начала работы:** [Быстрый старт](./QUICK-START.md)

Этот гайд содержит минимально необходимую информацию для подключения к API.

---

## Модули API

### 🔐 Аутентификация

Система авторизации через email с кодом верификации.

- **[REST API для авторизации](./auth/AUTH-REST.md)** - REST endpoints
- **[GraphQL API для авторизации](./auth/AUTH-GRAPHQL.md)** - GraphQL queries и mutations
- **[Гайд по интеграции авторизации](./auth/AUTH-INTEGRATION.md)** - пошаговое руководство

---

## Общая документация

- **[Типы данных](./common/TYPES.md)** - все типы данных, используемые в API
- **[Коды ошибок](./common/ERRORS.md)** - HTTP коды и формат ошибок

---

## Структура документации

```
docs/
├── README.md                    # Главная страница (вы здесь)
├── QUICK-START.md              # Быстрый старт
│
├── auth/                       # Модуль авторизации
│   ├── AUTH-REST.md           # REST endpoints
│   ├── AUTH-GRAPHQL.md        # GraphQL API
│   └── AUTH-INTEGRATION.md    # Гайд по интеграции
│
└── common/                     # Общая документация
    ├── TYPES.md               # Типы данных
    └── ERRORS.md              # Коды ошибок
```

---

## Основные концепции

### Аутентификация

API использует JWT токены:
- **Access Token** (15 минут) - передается в заголовке Authorization
- **Refresh Token** (7 дней) - хранится в httpOnly cookie

### CORS

API настроен для работы с:
- `https://saliy-shop.ru` - основной сайт
- `https://admin.saliy-shop.ru` - админка
- `http://localhost:3000` - для разработки

### Credentials

Для отправки cookies обязательно использовать `credentials: 'include'`

---

## Что использовать: REST или GraphQL?

**REST API:**
- ✅ Проще интегрировать
- ✅ Стандартные HTTP методы
- ✅ Привычная структура

**GraphQL API:**
- ✅ Гибкость в выборе полей
- ✅ Один endpoint для всех запросов
- ✅ Типизация из коробки
- ✅ GraphQL Playground для тестирования

**Оба API предоставляют одинаковый функционал - выбирайте что удобнее!**

---

## Тестирование API

### REST API
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)
- curl

### GraphQL API
- [GraphQL Playground](https://saliy-shop.ru/api/graphql) - встроенный
- [Apollo Studio](https://studio.apollographql.com/)
- [Altair GraphQL Client](https://altairgraphql.dev/)

---

## Будущие модули

В разработке:

- 🛍️ **Продукты** - каталог товаров
- 🛒 **Корзина** - управление корзиной покупок
- 📦 **Заказы** - оформление и отслеживание заказов
- 👤 **Профиль** - управление профилем пользователя
- 💳 **Платежи** - интеграция с платежными системами

---

## Changelog

### v0.0.1 (2026-03-25)
- ✅ Аутентификация через email с кодом
- ✅ JWT токены (access + refresh)
- ✅ REST и GraphQL API
- ✅ Базовый профиль пользователя

---

## Контакты и поддержка

При возникновении проблем или вопросов обращайтесь к backend разработчику.

**Last Updated:** 2026-03-25
