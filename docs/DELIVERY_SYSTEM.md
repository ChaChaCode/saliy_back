# Система доставки и данных пользователя ViceSeason

## 📋 Содержание

1. [Обзор системы](#обзор-системы)
2. [Архитектура](#архитектура)
3. [Модели данных](#модели-данных)
4. [Flow данных](#flow-данных)
5. [API Endpoints](#api-endpoints)
6. [Интеграция с CDEK](#интеграция-с-cdek)
7. [Примеры использования](#примеры-использования)
8. [Внедрение в ваш проект](#внедрение-в-ваш-проект)

---

## Обзор системы

Система доставки ViceSeason поддерживает:

- ✅ **3 типа доставки:**
  - `CDEK_PICKUP` — самовывоз из ПВЗ СДЭК (RU/BY)
  - `CDEK_COURIER` — курьерская доставка СДЭК (RU/BY)
  - `STANDARD` — обычная доставка (все остальные страны)

- ✅ **Гости и авторизованные пользователи:**
  - Гости заполняют данные при оформлении заказа
  - Авторизованные пользователи могут сохранять адрес в профиле

- ✅ **Интеграция с CDEK API:**
  - Получение списка стран/регионов/городов
  - Поиск пунктов выдачи
  - Расчёт стоимости доставки
  - Автоматическое создание заказа в СДЭК
  - Webhook для обновления статусов

---

## Архитектура

### Структура модулей

```
src/
├── orders/
│   ├── delivery.service.ts        # Логика доставки + СДЭК API
│   ├── delivery.controller.ts     # Endpoints доставки
│   ├── orders.service.ts          # Логика создания заказов
│   ├── orders.controller.ts       # Endpoints заказов
│   └── dto/
│       ├── create-order.dto.ts    # DTO для создания заказа
│       └── delivery.dto.ts        # DTO для доставки
├── users/
│   └── users.service.ts           # Управление профилем пользователя
└── prisma/schema/
    ├── user.prisma                # Модель пользователя
    ├── order.prisma               # Модель заказа
    └── _enums.prisma              # Enums (DeliveryType, PaymentMethod, OrderStatus)
```

### Принципы работы

1. **Разделение ответственности:**
   - `DeliveryService` — работа с СДЭК API (локации, тарифы, ПВЗ)
   - `OrdersService` — бизнес-логика заказов
   - `UsersService` — профиль пользователя

2. **Хранение адреса:**
   - В `User` — для авторизованных (сохраняется в профиле)
   - В `Order` — для всех заказов (снимок данных на момент оформления)

3. **Гибкость для гостей:**
   - Гости могут оформить заказ без регистрации
   - Все данные передаются через `CreateOrderDto`

---

## Модели данных

### User (профиль пользователя)

```prisma
model User {
  // Основные поля
  id                Int      @id @default(autoincrement())
  firstName         String?
  lastName          String?
  phone             String?
  email             String?  @unique
  instagram         String?

  // Адрес доставки (сохраняется для удобства)
  street            String?
  apartment         String?
  postalCode        String?

  // CDEK локация
  cdekCityCode      Int?     @map("cdek_city_code")
  cdekCountryCode   String?  @map("cdek_country_code")
  cdekRegionCode    Int?     @map("cdek_region_code")
  cityName          String?  @map("city_name")
  countryName       String?  @map("country_name")
  regionName        String?  @map("region_name")

  // Настройки
  currency          String   @default("RUB")
  language          String   @default("ru")

  // Связи
  orders            Order[]
  cartItems         CartItem[]
}
```

**Ключевые поля для доставки:**
- `cdekCityCode` — код города СДЭК (для расчёта стоимости)
- `cdekCountryCode` / `cdekRegionCode` — для селектов
- `cityName` / `countryName` / `regionName` — для отображения
- `street` / `apartment` / `postalCode` — адрес доставки

### Order (заказ)

```prisma
model Order {
  id                Int           @id @default(autoincrement())
  orderNumber       String        @unique
  userId            Int?          // NULL для гостей

  // Контактная информация (снимок на момент заказа)
  firstName         String
  lastName          String
  phone             String
  email             String
  instagram         String?

  // Адрес доставки (снимок на момент заказа)
  street            String?
  apartment         String?
  postalCode        String?
  pickupPoint       String?       // Код ПВЗ СДЭК

  // Локация (снимок на момент заказа)
  cdekCityCode      Int?          @map("cdek_city_code")
  cityName          String?       @map("city_name")
  countryName       String?       @map("country_name")
  regionName        String?       @map("region_name")

  // Доставка
  deliveryType      DeliveryType
  deliveryPrice     Float         @default(0)
  deliveryTotal     Float         @default(0)

  // Оплата
  paymentMethod     PaymentMethod
  currency          String        @default("RUB")

  // Суммы
  subtotal          Float
  discountAmount    Float         @default(0)
  total             Float

  // Статус
  status            OrderStatus   @default(PENDING)
  isPaid            Boolean       @default(false)

  // СДЭК интеграция
  cdekUuid          String?       @map("cdek_uuid")
  cdekNumber        String?       @map("cdek_number")
  cdekStatus        String?       @map("cdek_status")
  cdekStatusName    String?       @map("cdek_status_name")
  cdekStatusDate    DateTime?     @map("cdek_status_date")

  // Связи
  items             OrderItem[]
  user              User?         @relation(fields: [userId], references: [id])

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
}
```

**Важно:** Заказ хранит **снимок** данных на момент оформления. Если пользователь потом изменит адрес в профиле — заказ останется с оригинальным адресом.

### Enums

```prisma
enum DeliveryType {
  CDEK_PICKUP   // ПВЗ СДЭК
  CDEK_COURIER  // Курьер СДЭК
  STANDARD      // Обычная доставка
}

enum PaymentMethod {
  CARD_ONLINE   // Альфа-Банк (автоматическая)
  DOLYAME       // Рассрочка Долями
  BLIK          // BLIK (Польша, ручная)
  REVOLUT       // Revolut (ручная)
  CRYPTO        // Криптовалюта (ручная)
  PAYPAL        // PayPal (ручная)
  PAYSEND       // Paysend (ручная)
  ZELLE         // Zelle (ручная)
  CARD_MANUAL   // Оплата картой через менеджера
}

enum OrderStatus {
  PENDING          // Ожидает оплаты
  PAYMENT_FAILED   // Оплата не прошла
  CONFIRMED        // Подтверждён
  PROCESSING       // В обработке
  SHIPPED          // Отправлен
  DELIVERED        // Доставлен
  CANCELLED        // Отменён
  REFUNDED         // Возврат
  PREORDER         // Предзаказ
}
```

---

## Flow данных

### 1. Выбор адреса доставки (фронтенд)

#### Шаг 1: Получить список стран

```typescript
GET /delivery/countries?lang=ru

Response:
{
  "countries": [
    {
      "id": 1,
      "code": "RU",
      "name": "Россия",
      "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
    },
    {
      "id": 2,
      "code": "BY",
      "name": "Беларусь",
      "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
    },
    {
      "id": 3,
      "code": "PL",
      "name": "Польша",
      "deliveryTypes": ["STANDARD"]
    }
  ]
}
```

**Логика на фронте:**
- Если `deliveryTypes` включает `CDEK_PICKUP` или `CDEK_COURIER` → показываем селекты регионов/городов
- Иначе → показываем текстовые поля для адреса

#### Шаг 2А: Для СДЭК стран (RU/BY) — получить регионы

```typescript
GET /delivery/regions?countryCode=RU

Response:
{
  "regions": [
    {
      "code": 77,
      "name": "Москва",
      "countryCode": "RU"
    },
    {
      "code": 78,
      "name": "Санкт-Петербург",
      "countryCode": "RU"
    }
  ]
}
```

#### Шаг 3А: Получить города региона

```typescript
GET /delivery/cities?countryCode=RU&regionCode=77

Response:
{
  "cities": [
    {
      "code": 44,
      "name": "Москва",
      "regionCode": 77,
      "region": "Москва",
      "countryCode": "RU"
    }
  ]
}
```

**Важно:** Сохраняем `cityCode` — он нужен для расчёта доставки!

#### Шаг 4А: Рассчитать стоимость доставки

```typescript
GET /delivery/prices?cityCode=44&weight=500&currency=RUB

Response:
{
  "pickup": {
    "tariffCode": 136,
    "tariffName": "Посылка склад-склад",
    "deliverySum": 250,
    "periodMin": 2,
    "periodMax": 4,
    "currency": "RUB"
  },
  "courier": {
    "tariffCode": 137,
    "tariffName": "Посылка склад-дверь",
    "deliverySum": 400,
    "periodMin": 2,
    "periodMax": 4,
    "currency": "RUB"
  }
}
```

**Вес заказа** вычисляется из товаров в корзине. По умолчанию 500г.

#### Шаг 5А: Если выбран CDEK_PICKUP — получить ПВЗ

```typescript
GET /delivery/pickup-points?cityCode=44

Response:
{
  "points": [
    {
      "code": "MSK123",
      "name": "СДЭК на Ленинском",
      "address": "Москва, Ленинский проспект, д. 1",
      "city": "Москва",
      "coordinates": [37.5, 55.7],
      "workTime": "Пн-Пт 9:00-21:00",
      "phones": ["+74951234567"],
      "isDressingRoom": true,
      "haveCashless": true
    }
  ]
}
```

### 2. Сохранение адреса в профиле (опционально)

Для авторизованных пользователей можно сохранить адрес:

```typescript
PATCH /users/profile

Body:
{
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+79001234567",
  "email": "ivan@example.com",
  "cdekCountryCode": "RU",
  "cdekRegionCode": 77,
  "cdekCityCode": 44,
  "cityName": "Москва",
  "countryName": "Россия",
  "regionName": "Москва",
  "street": "Ленинский проспект, д. 1",
  "apartment": "42",
  "postalCode": "119991"
}
```

При следующем оформлении эти данные можно **подставить автоматически**.

### 3. Создание заказа

```typescript
POST /orders
Authorization: Bearer <JWT> // Опционально

Body:
{
  "contactInfo": {
    "firstName": "Иван",
    "lastName": "Иванов",
    "phone": "+79001234567",
    "email": "ivan@example.com",
    "instagram": "@ivan"
  },
  "deliveryInfo": {
    "deliveryType": "CDEK_PICKUP",
    "countryCode": "RU",
    "country": "Россия",
    "region": "Москва",
    "city": "Москва",
    "cityId": 44,
    "pickupPoint": "MSK123",
    "pickupPointAddress": "Ленинский проспект, д. 1",
    "deliveryPrice": 250
  },
  "paymentInfo": {
    "paymentMethod": "CARD_ONLINE",
    "currency": "RUB",
    "bonusToUse": 0,
    "promoCode": "SALE10"
  },
  "guestCart": [ // Только для гостей
    {
      "productId": 1,
      "color": "black",
      "size": "M",
      "quantity": 1
    }
  ]
}

Response:
{
  "id": 123,
  "orderNumber": "VS20240101-ABCD1234",
  "status": "PENDING",
  "isPaid": false,
  "currency": "RUB",
  "subtotal": 5000,
  "total": 5250,
  "deliveryTotal": 250,
  "paymentUrl": "https://alfa.ru/payment/...",
  "paymentId": "abc123",
  "isManualPayment": false,
  "paymentMethod": "CARD_ONLINE",
  "message": null,
  "items": [...],
  "cdekUuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Логика на фронте после создания заказа:**

```typescript
if (order.isManualPayment) {
  // Ручная оплата → показываем страницу "Ожидание подтверждения"
  router.push(`/orders/pending/${order.orderNumber}`);
} else if (order.paymentUrl) {
  // Автоматическая оплата → редирект на платёжку
  window.location.href = order.paymentUrl;
} else {
  // Бесплатный заказ или оплата бонусами
  router.push(`/orders/success/${order.orderNumber}`);
}
```

---

## API Endpoints

### Доставка (DeliveryController)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/delivery/countries?lang=ru` | Список стран с типами доставки |
| GET | `/delivery/regions?countryCode=RU` | Регионы страны |
| GET | `/delivery/cities?countryCode=RU&regionCode=77&search=Моск` | Города региона (+ поиск) |
| GET | `/delivery/pickup-points?cityCode=44` | ПВЗ СДЭК в городе |
| GET | `/delivery/postamats?cityCode=44` | Постаматы СДЭК |
| GET | `/delivery/prices?cityCode=44&weight=500&currency=RUB` | Стоимость доставки (ПВЗ + курьер) |
| POST | `/delivery/calculate` | Полный расчёт тарифов |
| POST | `/delivery/cdek-webhook` | Webhook от СДЭК (автообновление статусов) |

### Заказы (OrdersController)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/orders` | Создать заказ (авторизованный или гость) |
| POST | `/orders/preorder` | Создать предзаказ |
| GET | `/orders/my?page=1&limit=10` | Мои заказы (только авторизованный) |
| GET | `/orders/:orderNumber?token=...` | Детали заказа |
| GET | `/orders/calculate/total?currency=RUB&bonusToUse=100&promoCode=SALE10&deliveryType=CDEK_PICKUP&deliveryPrice=250` | Расчёт итога (GET) |
| POST | `/orders/calculate/total` | Расчёт итога (POST, с guestCart) |

---

## Интеграция с CDEK

### Конфигурация

```env
# Test
CDEK_TEST_MODE=true
CDEK_CLIENT_ID_TEST=wqGwiQx0gg8mLtiEKsUinjVSICCjtTEP
CDEK_CLIENT_SECRET_TEST=RmAmgvSgSl1yirlz9QupbzOJVqhCxcP5

# Production
CDEK_TEST_MODE=false
CDEK_CLIENT_ID=<ваш ID>
CDEK_CLIENT_SECRET=<ваш секрет>

# Склад отправления
CDEK_WAREHOUSE_CITY_CODE=9220  # Минск
```

### Создание заказа в СДЭК

Заказ в СДЭК создаётся автоматически при оформлении:

```typescript
// orders.service.ts

async createOrder(userId: string | null, dto: CreateOrderDto) {
  // 1. Создаём заказ в БД
  const order = await this.prisma.order.create({...});

  // 2. Если СДЭК доставка — создаём заказ в СДЭК
  if (dto.deliveryInfo.deliveryType === 'CDEK_PICKUP' || dto.deliveryInfo.deliveryType === 'CDEK_COURIER') {
    const cdekOrder = await this.deliveryService.createCdekOrder({
      orderNumber: order.orderNumber,
      deliveryType: dto.deliveryInfo.deliveryType,
      recipient: {
        firstName: dto.contactInfo.firstName,
        lastName: dto.contactInfo.lastName,
        phone: dto.contactInfo.phone,
        email: dto.contactInfo.email,
      },
      address: {
        cityCode: dto.deliveryInfo.cityId!,
        street: dto.deliveryInfo.street,
        apartment: dto.deliveryInfo.apartment,
        pickupPointCode: dto.deliveryInfo.pickupPoint,
      },
      items: order.items.map(item => ({
        name: item.productName,
        nameEn: item.productNameEn,
        sku: item.productSlug,
        quantity: item.quantity,
        price: item.price,
        weight: 200, // Вес товара в граммах
        material: 'Cotton',
        countryOfOrigin: 'BY',
        url: `https://viceseason.com/product/${item.productSlug}`,
      })),
    });

    // 3. Сохраняем UUID СДЭК
    await this.prisma.order.update({
      where: { id: order.id },
      data: { cdekUuid: cdekOrder.uuid },
    });
  }

  return order;
}
```

### Webhook для обновления статусов

СДЭК отправляет webhook при изменении статуса заказа:

```typescript
// delivery.controller.ts

@Post('cdek-webhook')
async handleCdekWebhook(@Body() payload: any) {
  // payload.type === 'ORDER_STATUS'
  // payload.uuid === UUID заказа
  // payload.attributes.code === 'RECEIVED' (статус СДЭК)

  const result = await this.deliveryService.handleCdekWebhook(payload);
  return { success: true, ...result };
}
```

**Маппинг статусов СДЭК → наши статусы:**

| CDEK статус | Наш статус |
|-------------|------------|
| `CREATED`, `ACCEPTED` | `CONFIRMED` |
| `RECEIVED_AT_SHIPMENT_WAREHOUSE`, `READY_FOR_SHIPMENT_IN_SENDER_CITY` | `PROCESSING` |
| `TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY`, `SENT_TO_RECIPIENT_CITY` | `SHIPPED` |
| `ACCEPTED_AT_PICK_UP_POINT`, `TAKEN_BY_COURIER` | `SHIPPED` |
| `RECEIVED`, `DELIVERED` | `DELIVERED` |
| `NOT_DELIVERED` | `CANCELLED` |
| `RETURNED`, `RETURNED_TO_SENDER` | `REFUNDED` |

**Регистрация webhook (один раз):**

```bash
POST /delivery/cdek-webhook/register
Body: { "url": "https://api.viceseason.com/delivery/cdek-webhook" }
```

---

## Примеры использования

### Пример 1: Гость оформляет заказ с доставкой СДЭК (ПВЗ)

```typescript
// 1. Получаем страны
const { countries } = await fetch('/delivery/countries').then(r => r.json());
// Выбираем: RU

// 2. Получаем регионы
const { regions } = await fetch('/delivery/regions?countryCode=RU').then(r => r.json());
// Выбираем: Москва (code: 77)

// 3. Получаем города
const { cities } = await fetch('/delivery/cities?countryCode=RU&regionCode=77').then(r => r.json());
// Выбираем: Москва (code: 44)

// 4. Получаем стоимость доставки
const prices = await fetch('/delivery/prices?cityCode=44&weight=500&currency=RUB').then(r => r.json());
// pickup: { deliverySum: 250 }
// courier: { deliverySum: 400 }

// 5. Выбираем ПВЗ (если тип = CDEK_PICKUP)
const { points } = await fetch('/delivery/pickup-points?cityCode=44').then(r => r.json());
// Выбираем: MSK123

// 6. Создаём заказ
const order = await fetch('/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contactInfo: {
      firstName: 'Иван',
      lastName: 'Иванов',
      phone: '+79001234567',
      email: 'ivan@example.com',
    },
    deliveryInfo: {
      deliveryType: 'CDEK_PICKUP',
      countryCode: 'RU',
      country: 'Россия',
      region: 'Москва',
      city: 'Москва',
      cityId: 44,
      pickupPoint: 'MSK123',
      pickupPointAddress: 'Ленинский проспект, д. 1',
      deliveryPrice: 250,
    },
    paymentInfo: {
      paymentMethod: 'CARD_ONLINE',
      currency: 'RUB',
    },
    guestCart: [
      { productId: 1, color: 'black', size: 'M', quantity: 1 }
    ]
  })
}).then(r => r.json());

// 7. Редирект на оплату
if (order.paymentUrl) {
  window.location.href = order.paymentUrl;
}
```

### Пример 2: Авторизованный пользователь оформляет заказ (курьер СДЭК)

```typescript
// 1. Получаем профиль пользователя
const user = await fetch('/users/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// user уже содержит: cdekCityCode, cityName, street, apartment

// 2. Рассчитываем стоимость доставки
const prices = await fetch(`/delivery/prices?cityCode=${user.cdekCityCode}&weight=500&currency=RUB`)
  .then(r => r.json());

// 3. Создаём заказ (данные из профиля подставлены)
const order = await fetch('/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contactInfo: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      instagram: user.instagram,
    },
    deliveryInfo: {
      deliveryType: 'CDEK_COURIER',
      countryCode: user.cdekCountryCode,
      country: user.countryName,
      region: user.regionName,
      city: user.cityName,
      cityId: user.cdekCityCode,
      street: user.street,
      apartment: user.apartment,
      postalCode: user.postalCode,
      deliveryPrice: prices.courier.deliverySum,
    },
    paymentInfo: {
      paymentMethod: 'CARD_ONLINE',
      currency: 'RUB',
      bonusToUse: 100,
      promoCode: 'SALE10',
    }
  })
}).then(r => r.json());

// Корзина берётся из БД автоматически (авторизованный пользователь)
```

### Пример 3: Гость из Польши (STANDARD доставка)

```typescript
// 1. Выбираем страну: PL (deliveryTypes: ['STANDARD'])

// 2. Заполняем адрес текстом (без СДЭК)
const order = await fetch('/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contactInfo: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '+48123456789',
      email: 'jan@example.com',
    },
    deliveryInfo: {
      deliveryType: 'STANDARD',
      countryCode: 'PL',
      country: 'Polska',
      city: 'Warszawa',
      street: 'ul. Marszałkowska 1',
      apartment: '10',
      postalCode: '00-001',
      deliveryPrice: 1500, // Фиксированная цена для STANDARD
    },
    paymentInfo: {
      paymentMethod: 'BLIK', // Ручная оплата
      currency: 'PLN',
    },
    guestCart: [
      { productId: 1, color: 'black', size: 'L', quantity: 1 }
    ]
  })
}).then(r => r.json());

// order.isManualPayment === true
// order.message === "Менеджер свяжется с вами для оплаты"

// Редирект на страницу ожидания
router.push(`/orders/pending/${order.orderNumber}`);
```

---

## Внедрение в ваш проект

### Шаг 1: Установить зависимости

```bash
npm install @nestjs/common @nestjs/config @prisma/client
npm install i18n-iso-countries  # Для списка стран
```

### Шаг 2: Скопировать модели Prisma

```bash
# Скопируйте из viceseason-backend:
prisma/schema/user.prisma
prisma/schema/order.prisma
prisma/schema/_enums.prisma
```

**Ключевые поля в User:**
```prisma
cdekCityCode      Int?
cdekCountryCode   String?
cdekRegionCode    Int?
cityName          String?
countryName       String?
regionName        String?
street            String?
apartment         String?
postalCode        String?
```

**Ключевые поля в Order:**
```prisma
cdekCityCode      Int?
cityName          String?
countryName       String?
regionName        String?
street            String?
apartment         String?
postalCode        String?
pickupPoint       String?
deliveryType      DeliveryType
deliveryPrice     Float
cdekUuid          String?
cdekNumber        String?
cdekStatus        String?
```

### Шаг 3: Скопировать сервисы

```bash
# Скопируйте из viceseason-backend:
src/orders/delivery.service.ts
src/orders/delivery.controller.ts
src/orders/dto/delivery.dto.ts
```

**Минимальная интеграция:**
- `DeliveryService` — работа с СДЭК API
- `DeliveryController` — endpoints `/delivery/*`

### Шаг 4: Настроить конфигурацию

```env
# СДЭК
CDEK_TEST_MODE=true  # Переключить на false для продакшна
CDEK_CLIENT_ID=<ваш ID>
CDEK_CLIENT_SECRET=<ваш секрет>
CDEK_WAREHOUSE_CITY_CODE=44  # Код вашего города-склада
```

**Получить тестовые credentials:**
https://edu.cdek.ru/integration/

**Получить боевые credentials:**
https://www.cdek.ru/ru/integration/api

### Шаг 5: Зарегистрировать модули

```typescript
// app.module.ts
import { DeliveryService } from './orders/delivery.service';
import { DeliveryController } from './orders/delivery.controller';

@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class AppModule {}
```

### Шаг 6: DTO для создания заказа

```typescript
// create-order.dto.ts (упрощённый)
export class ContactInfoDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() phone: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() instagram?: string;
}

export class DeliveryInfoDto {
  @IsEnum(['CDEK_PICKUP', 'CDEK_COURIER', 'STANDARD'])
  deliveryType: 'CDEK_PICKUP' | 'CDEK_COURIER' | 'STANDARD';

  @IsOptional() @IsString() countryCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsNumber() cityId?: number;  // CDEK city code
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() apartment?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() pickupPoint?: string;  // CDEK ПВЗ код
  @IsOptional() @IsNumber() deliveryPrice?: number;
}

export class PaymentInfoDto {
  @IsEnum(['CARD_ONLINE', 'DOLYAME', 'BLIK', ...])
  paymentMethod: PaymentMethod;

  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() bonusToUse?: number;
  @IsOptional() @IsString() promoCode?: string;
}

export class CreateOrderDto {
  @ValidateNested() @Type(() => ContactInfoDto)
  contactInfo: ContactInfoDto;

  @ValidateNested() @Type(() => DeliveryInfoDto)
  deliveryInfo: DeliveryInfoDto;

  @ValidateNested() @Type(() => PaymentInfoDto)
  paymentInfo: PaymentInfoDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  guestCart?: GuestCartItemDto[];  // Для гостей
}
```

### Шаг 7: Логика создания заказа

```typescript
// orders.service.ts (упрощённо)
async createOrder(userId: string | null, dto: CreateOrderDto) {
  // 1. Получить товары (из БД корзины или guestCart)
  const items = userId
    ? await this.getCartItems(userId)
    : await this.validateGuestCart(dto.guestCart);

  // 2. Рассчитать суммы
  const subtotal = this.calculateSubtotal(items);
  const total = subtotal + dto.deliveryInfo.deliveryPrice;

  // 3. Создать заказ в БД
  const order = await this.prisma.order.create({
    data: {
      orderNumber: this.generateOrderNumber(),
      userId: userId ? parseInt(userId) : null,

      // Контакты
      firstName: dto.contactInfo.firstName,
      lastName: dto.contactInfo.lastName,
      phone: dto.contactInfo.phone,
      email: dto.contactInfo.email,
      instagram: dto.contactInfo.instagram,

      // Адрес
      cdekCityCode: dto.deliveryInfo.cityId,
      cityName: dto.deliveryInfo.city,
      countryName: dto.deliveryInfo.country,
      regionName: dto.deliveryInfo.region,
      street: dto.deliveryInfo.street,
      apartment: dto.deliveryInfo.apartment,
      postalCode: dto.deliveryInfo.postalCode,
      pickupPoint: dto.deliveryInfo.pickupPoint,

      // Доставка
      deliveryType: dto.deliveryInfo.deliveryType,
      deliveryPrice: dto.deliveryInfo.deliveryPrice,
      deliveryTotal: dto.deliveryInfo.deliveryPrice,

      // Оплата
      paymentMethod: dto.paymentInfo.paymentMethod,
      currency: dto.paymentInfo.currency || 'RUB',

      // Суммы
      subtotal,
      total,

      status: 'PENDING',
      items: {
        create: items.map(item => ({
          productId: item.productId,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    },
    include: { items: true },
  });

  // 4. Если СДЭК — создать заказ в СДЭК
  if (dto.deliveryInfo.deliveryType === 'CDEK_PICKUP' || dto.deliveryInfo.deliveryType === 'CDEK_COURIER') {
    const cdekOrder = await this.deliveryService.createCdekOrder({
      orderNumber: order.orderNumber,
      deliveryType: dto.deliveryInfo.deliveryType,
      recipient: {
        firstName: dto.contactInfo.firstName,
        lastName: dto.contactInfo.lastName,
        phone: dto.contactInfo.phone,
        email: dto.contactInfo.email,
      },
      address: {
        cityCode: dto.deliveryInfo.cityId!,
        street: dto.deliveryInfo.street,
        apartment: dto.deliveryInfo.apartment,
        pickupPointCode: dto.deliveryInfo.pickupPoint,
      },
      items: order.items.map(item => ({
        name: item.product.name,
        sku: item.product.slug,
        quantity: item.quantity,
        price: item.price,
        weight: 200, // Вес товара в граммах
      })),
    });

    // Сохранить UUID СДЭК
    await this.prisma.order.update({
      where: { id: order.id },
      data: { cdekUuid: cdekOrder.uuid },
    });
  }

  // 5. Инициировать оплату (если автоматическая)
  let paymentUrl = null;
  if (dto.paymentInfo.paymentMethod === 'CARD_ONLINE') {
    paymentUrl = await this.paymentsService.createPayment(order);
  }

  return {
    ...order,
    paymentUrl,
    isManualPayment: ['BLIK', 'REVOLUT', 'CRYPTO', ...].includes(dto.paymentInfo.paymentMethod),
  };
}
```

### Шаг 8: Фронтенд интеграция

**Компоненты:**
1. `AddressSelect.tsx` — селекты страна/регион/город (для СДЭК)
2. `AddressInput.tsx` — текстовые поля (для STANDARD)
3. `PickupPointsMap.tsx` — карта с ПВЗ СДЭК
4. `CheckoutForm.tsx` — форма оформления заказа

**Hooks:**
```typescript
// useDelivery.ts
export function useDelivery() {
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [deliveryPrices, setDeliveryPrices] = useState(null);

  const loadCountries = async () => {
    const res = await fetch('/delivery/countries?lang=ru');
    setCountries(await res.json());
  };

  const loadRegions = async (countryCode: string) => {
    const res = await fetch(`/delivery/regions?countryCode=${countryCode}`);
    setRegions(await res.json());
  };

  const loadCities = async (countryCode: string, regionCode?: number) => {
    const res = await fetch(`/delivery/cities?countryCode=${countryCode}&regionCode=${regionCode}`);
    setCities(await res.json());
  };

  const loadPickupPoints = async (cityCode: number) => {
    const res = await fetch(`/delivery/pickup-points?cityCode=${cityCode}`);
    setPickupPoints(await res.json());
  };

  const calculateDelivery = async (cityCode: number, weight: number) => {
    const res = await fetch(`/delivery/prices?cityCode=${cityCode}&weight=${weight}&currency=RUB`);
    setDeliveryPrices(await res.json());
  };

  return {
    countries, regions, cities, pickupPoints, deliveryPrices,
    loadCountries, loadRegions, loadCities, loadPickupPoints, calculateDelivery,
  };
}
```

### Шаг 9: Тестирование

**Тестовая среда СДЭК:**
- API: `https://api.edu.cdek.ru/v2`
- Тестовые заказы можно создавать без реальной отправки
- Статусы можно менять вручную в личном кабинете

**Чеклист:**
- ✅ Получение списка стран работает
- ✅ Получение регионов/городов работает для RU/BY
- ✅ Расчёт стоимости доставки возвращает корректные цены
- ✅ Получение ПВЗ возвращает список точек
- ✅ Создание заказа в БД успешно
- ✅ Создание заказа в СДЭК возвращает UUID
- ✅ Webhook от СДЭК обрабатывается и обновляет статус

---

## Дополнительные возможности

### 1. Автозаполнение адреса (геолокация)

```typescript
// Определить город пользователя по IP
const geoData = await fetch('https://ipapi.co/json/').then(r => r.json());

// Найти город в СДЭК
const { cities } = await fetch(`/delivery/cities?countryCode=${geoData.country_code}&search=${geoData.city}`)
  .then(r => r.json());

if (cities.length > 0) {
  // Подставить автоматически
  setSelectedCity(cities[0]);
}
```

### 2. Сохранение нескольких адресов

```prisma
model UserAddress {
  id              Int      @id @default(autoincrement())
  userId          Int
  label           String   // "Дом", "Работа", "Дача"
  isDefault       Boolean  @default(false)

  cdekCityCode    Int?
  cityName        String?
  street          String?
  apartment       String?
  postalCode      String?

  user            User     @relation(fields: [userId], references: [id])
}
```

### 3. Валидация адреса (дополнительно)

```typescript
// Проверить корректность адреса через СДЭК API
const isValid = await deliveryService.validateAddress({
  cityCode: 44,
  street: 'Ленинский проспект',
});

if (!isValid) {
  throw new Error('Адрес не найден в СДЭК');
}
```

### 4. Отслеживание посылки

```typescript
// Получить трекинг URL
const trackingUrl = deliveryService.getCdekTrackingUrl(order.cdekNumber);
// https://www.cdek.ru/ru/tracking?order_id=1234567890

// Или встроенный виджет СДЭК
<iframe src={`https://www.cdek.ru/ru/tracking/widget?order_id=${order.cdekNumber}`} />
```

---

## Резюме

### Что нужно скопировать из viceseason-backend:

1. **Prisma модели:**
   - `prisma/schema/user.prisma` (поля адреса)
   - `prisma/schema/order.prisma` (поля адреса и СДЭК)
   - `prisma/schema/_enums.prisma` (DeliveryType, PaymentMethod, OrderStatus)

2. **Сервисы:**
   - `src/orders/delivery.service.ts` — полная интеграция с СДЭК API
   - `src/orders/delivery.controller.ts` — endpoints доставки

3. **DTO:**
   - `src/orders/dto/delivery.dto.ts` — DTO для доставки
   - `src/orders/dto/create-order.dto.ts` — DTO для создания заказа

### Ключевые концепции:

1. **Хранение адреса:**
   - В User — для удобства (подставляется автоматически)
   - В Order — снимок на момент заказа (никогда не меняется)

2. **Поддержка гостей:**
   - Гости могут оформить заказ без регистрации
   - Адрес передаётся через `CreateOrderDto`

3. **Три типа доставки:**
   - CDEK_PICKUP — для RU/BY, нужен код ПВЗ
   - CDEK_COURIER — для RU/BY, нужен полный адрес
   - STANDARD — для всех остальных стран, текстовый адрес

4. **Интеграция с CDEK:**
   - Автоматическое создание заказа
   - Webhook для обновления статусов
   - Расчёт стоимости доставки

---

**Автор:** ViceSeason Backend Team
**Дата:** 2024-01-01
**Версия:** 1.0
