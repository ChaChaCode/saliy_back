# Система доставки и профиля пользователя - Итоговая реализация

## 📋 Краткое описание

Реализована полноценная система управления профилем пользователя и интеграция с API CDEK для расчёта и оформления доставки.

---

## ✅ Что было реализовано

### 1. **Расширение модели User в базе данных**

Добавлены поля для хранения персональной информации и адреса доставки:

**Файл:** `prisma/schema/auth.prisma`

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Персональная информация
  firstName  String? @map("first_name")
  lastName   String? @map("last_name")
  middleName String? @map("middle_name")
  phone      String? @map("phone")

  // Адрес доставки
  street     String? @map("street")
  apartment  String? @map("apartment")
  postalCode String? @map("postal_code")

  // CDEK локация
  cdekCityCode    Int?    @map("cdek_city_code")
  cdekCountryCode String? @map("cdek_country_code")
  cdekRegionCode  Int?    @map("cdek_region_code")
  cityName        String? @map("city_name")
  countryName     String? @map("country_name")
  regionName      String? @map("region_name")

  refreshTokens     RefreshToken[]
  verificationCodes VerificationCode[]
}
```

**Миграция:** `20260325114546_add_user_profile_and_delivery_address`

---

### 2. **Установлены необходимые пакеты**

```bash
npm install i18n-iso-countries      # Список стран (249 стран) с ISO стандартами
npm install @nestjs/axios axios     # HTTP клиент для запросов к CDEK API
```

---

### 3. **Создан модуль Delivery**

**Структура файлов:**
```
src/delivery/
├── delivery.service.ts     # Бизнес-логика и интеграция с CDEK API
├── delivery.controller.ts  # REST API endpoints
└── delivery.module.ts      # NestJS модуль
```

---

### 4. **Реализованные возможности DeliveryService**

#### 4.1. Работа со странами (i18n-iso-countries)
- ✅ Получение списка всех стран мира (249 стран)
- ✅ Поддержка мультиязычности (ru, en, pl)
- ✅ Определение типов доставки для каждой страны
- ✅ RU, BY - поддержка CDEK (CDEK_PICKUP, CDEK_COURIER, STANDARD)
- ✅ Остальные страны - только STANDARD доставка

#### 4.2. Интеграция с CDEK API
- ✅ Авторизация в CDEK API (OAuth 2.0)
- ✅ Кэширование токена доступа
- ✅ Автоматическое переключение между тестовым и продакшн режимом
- ✅ Получение списка регионов страны
- ✅ Получение списка городов региона (с поддержкой поиска)
- ✅ Получение списка пунктов выдачи (ПВЗ) в городе
- ✅ Расчёт стоимости доставки (самовывоз и курьер)
- ✅ Определение сроков доставки

---

### 5. **API Endpoints**

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/delivery/countries?lang=ru` | Список всех стран с типами доставки |
| GET | `/delivery/countries/:code?lang=ru` | Информация о конкретной стране |
| GET | `/delivery/regions?countryCode=RU` | Регионы страны (CDEK) |
| GET | `/delivery/cities?countryCode=RU&regionCode=77` | Города региона (CDEK) |
| GET | `/delivery/pickup-points?cityCode=44` | Пункты выдачи CDEK в городе |
| GET | `/delivery/prices?cityCode=44&weight=500&currency=RUB` | Расчёт стоимости доставки |

---

### 6. **Конфигурация (.env)**

```env
# CDEK Доставка
# Режим работы (true - тестовый режим, false - продакшн)
CDEK_TEST_MODE=true

# Тестовые креденшелы (для разработки)
CDEK_CLIENT_ID_TEST=wqGwiQx0gg8mLtiEKsUinjVSICCjtTEP
CDEK_CLIENT_SECRET_TEST=RmAmgvSgSl1yirlz9QupbzOJVqhCxcP5

# Продакшн креденшелы (получить на https://www.cdek.ru/ru/integration/api)
CDEK_CLIENT_ID=
CDEK_CLIENT_SECRET=

# Код города склада отправления (9220 = Минск)
CDEK_WAREHOUSE_CITY_CODE=9220
```

---

## 🔄 Flow оформления заказа с доставкой CDEK

### Сценарий 1: Доставка в Россию/Беларусь (с CDEK)

```typescript
// 1. Выбрать страну
const countries = await GET('/delivery/countries?lang=ru');
// Выбираем: RU

// 2. Получить регионы
const regions = await GET('/delivery/regions?countryCode=RU');
// Выбираем: Москва (code: 77)

// 3. Получить города
const cities = await GET('/delivery/cities?countryCode=RU&regionCode=77');
// Выбираем: Москва (code: 44)

// 4. Рассчитать стоимость доставки
const prices = await GET('/delivery/prices?cityCode=44&weight=500&currency=RUB');
// Результат:
// {
//   pickup: { deliverySum: 250, periodMin: 2, periodMax: 4 },
//   courier: { deliverySum: 400, periodMin: 2, periodMax: 4 }
// }

// 5. Если выбран самовывоз - получить пункты выдачи
const pickupPoints = await GET('/delivery/pickup-points?cityCode=44');
// Выбираем пункт выдачи: MSK123

// 6. Создать заказ (будет реализовано позже)
const order = await POST('/orders', {
  deliveryInfo: {
    deliveryType: 'CDEK_PICKUP',
    countryCode: 'RU',
    country: 'Россия',
    city: 'Москва',
    cityId: 44,
    pickupPoint: 'MSK123',
    deliveryPrice: 250
  },
  // ... другие данные заказа
});
```

### Сценарий 2: Доставка в другие страны (STANDARD)

```typescript
// 1. Выбрать страну
const countries = await GET('/delivery/countries?lang=ru');
// Выбираем: PL (Польша)
// deliveryTypes: ['STANDARD']

// 2. Пользователь вводит адрес текстом
// - Город: Warszawa
// - Улица: ul. Marszałkowska 1
// - Квартира: 10
// - Индекс: 00-001

// 3. Создать заказ с фиксированной стоимостью доставки
const order = await POST('/orders', {
  deliveryInfo: {
    deliveryType: 'STANDARD',
    countryCode: 'PL',
    country: 'Polska',
    city: 'Warszawa',
    street: 'ul. Marszałkowska 1',
    apartment: '10',
    postalCode: '00-001',
    deliveryPrice: 1500 // фиксированная цена
  }
});
```

---

## 📊 Схема данных

### Поля User для сохранения адреса

| Поле | Тип | Описание |
|------|-----|----------|
| `firstName` | String? | Имя |
| `lastName` | String? | Фамилия |
| `middleName` | String? | Отчество |
| `phone` | String? | Телефон |
| `street` | String? | Улица |
| `apartment` | String? | Квартира/офис |
| `postalCode` | String? | Почтовый индекс |
| `cdekCityCode` | Int? | Код города CDEK (для расчёта доставки) |
| `cdekCountryCode` | String? | Код страны (RU, BY, PL) |
| `cdekRegionCode` | Int? | Код региона |
| `cityName` | String? | Название города (для отображения) |
| `countryName` | String? | Название страны |
| `regionName` | String? | Название региона |

---

## 🧪 Тестирование

### Примеры curl запросов:

```bash
# 1. Получить список стран
curl "http://localhost:3000/delivery/countries?lang=ru"

# 2. Получить регионы России
curl "http://localhost:3000/delivery/regions?countryCode=RU"

# 3. Получить города Москвы
curl "http://localhost:3000/delivery/cities?countryCode=RU&regionCode=77"

# 4. Получить пункты выдачи в Москве
curl "http://localhost:3000/delivery/pickup-points?cityCode=44"

# 5. Рассчитать стоимость доставки в Москву
curl "http://localhost:3000/delivery/prices?cityCode=44&weight=500&currency=RUB"
```

---

## 📝 Следующие шаги

### 1. Создание модели Order
Добавить поля для хранения адреса доставки в заказе (снимок на момент оформления).

### 2. Реализация OrdersService
- Создание заказа с сохранением адреса доставки
- Автоматическое создание заказа в CDEK API (для CDEK_PICKUP и CDEK_COURIER)
- Сохранение UUID заказа CDEK

### 3. Webhook от CDEK
- Регистрация webhook для получения обновлений статусов
- Автоматическое обновление статуса заказа при изменении в CDEK

### 4. Управление профилем пользователя
- Эндпоинт для сохранения адреса доставки в профиле
- Автозаполнение формы адреса для авторизованных пользователей
- Возможность сохранения нескольких адресов

### 5. Валидация данных
- Добавить DTO для валидации входных данных
- Проверка корректности адресов через CDEK API

---

## 📚 Документация

- **DELIVERY_API_USAGE.md** - Полное описание API с примерами использования
- **DELIVERY_QUICK_START.md** - Быстрый старт для интеграции
- **DELIVERY_SYSTEM.md** - Детальная документация системы доставки

---

## 🔗 Полезные ссылки

- **CDEK API документация:** https://api-docs.cdek.ru/
- **Тестовая среда CDEK:** https://edu.cdek.ru/
- **Получить prod креденшелы:** https://www.cdek.ru/ru/integration/api
- **Трекинг посылок:** https://www.cdek.ru/ru/tracking

---

## ⚠️ Важные замечания

### Безопасность:
- ✅ Креденшелы CDEK хранятся в `.env` (не коммитить!)
- ✅ Токен CDEK кэшируется в памяти и автоматически обновляется
- ✅ Используются параметризованные запросы (Prisma ORM)

### Производительность:
- ✅ Токен CDEK кэшируется для избежания лишних запросов
- ✅ Поддержка поиска городов для оптимизации UX

### Надёжность:
- ✅ Обработка ошибок с логированием
- ✅ Автоматическое переключение между тестовым и продакшн режимом
- ✅ Все query параметры валидируются (ParseIntPipe)

---

**Дата реализации:** 2026-03-25
**Версия:** 1.0
**Статус:** ✅ Готово к использованию (тестовый режим)
