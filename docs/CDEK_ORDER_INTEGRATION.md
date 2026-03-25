# 📦 Интеграция создания заказов CDEK

## Обзор

Теперь система поддерживает автоматическое создание заказов в CDEK и отслеживание их статусов через webhook.

---

## 🗄️ База данных

### Модель Order

```prisma
model Order {
  id           String   @id @default(uuid())
  orderNumber  String   @unique

  // Клиент
  userId       String?
  firstName    String
  lastName     String
  phone        String
  email        String

  // Адрес доставки (снэпшот)
  countryName  String?
  regionName   String?
  cityName     String?
  cdekCityCode Int?
  street       String?
  apartment    String?
  postalCode   String?
  pickupPoint  String? // Код ПВЗ CDEK

  // Доставка
  deliveryType  DeliveryType  // CDEK_PICKUP, CDEK_COURIER, STANDARD
  deliveryPrice Float

  // Оплата
  paymentMethod PaymentMethod
  currency      String @default("RUB")
  isPaid        Boolean @default(false)

  // Суммы
  subtotal       Float
  deliveryTotal  Float
  discountAmount Float
  total          Float

  // Статус
  status    OrderStatus @default(PENDING)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // CDEK интеграция
  cdekNumber     String?   // Номер заказа CDEK (для отслеживания)
  cdekUuid       String?   // UUID заказа в CDEK
  cdekStatus     String?   // Код статуса от CDEK
  cdekStatusDate DateTime? // Дата последнего обновления
  cdekStatusName String?   // Название статуса на русском

  items OrderItem[]
}
```

---

## 📡 API Endpoints

### 1. Создание заказа в CDEK

**Метод:** `DeliveryService.createCdekOrder()`

```typescript
const result = await deliveryService.createCdekOrder({
  orderNumber: 'ORD-2024-001',
  deliveryType: 'CDEK_PICKUP', // или 'CDEK_COURIER'
  recipient: {
    firstName: 'Иван',
    lastName: 'Петров',
    phone: '+79001234567',
    email: 'ivan@example.com',
  },
  address: {
    cityCode: 44, // Код города Москва
    pickupPointCode: 'MSK65', // Для самовывоза
    // Для курьера:
    // street: 'ул. Ленина, д. 10',
    // apartment: '15',
    // postalCode: '123456',
  },
  items: [
    {
      name: 'Футболка черная',
      sku: 'SHIRT-BLACK-M',
      quantity: 2,
      price: 1500,
      weight: 300, // граммы
    },
    {
      name: 'Кепка',
      sku: 'CAP-001',
      quantity: 1,
      price: 800,
      weight: 150,
    },
  ],
  comment: 'Позвонить за час до доставки',
});

// Результат:
// { uuid: '72753031-...', cdekNumber: null }
// cdekNumber придёт позже через webhook
```

---

### 2. Получение информации о заказе

**GET** `/api/delivery/orders/:uuid`

```bash
curl http://localhost:3000/api/delivery/orders/72753031-...
```

**Ответ:**
```json
{
  "uuid": "72753031-...",
  "cdekNumber": "1106478587",
  "status": "Принят на склад отправки",
  "statusCode": "RECEIVED_AT_SHIPMENT_WAREHOUSE"
}
```

---

### 3. Получение URL для отслеживания

**GET** `/api/delivery/tracking/:cdekNumber`

```bash
curl http://localhost:3000/api/delivery/tracking/1106478587
```

**Ответ:**
```json
{
  "cdekNumber": "1106478587",
  "trackingUrl": "https://www.cdek.ru/ru/tracking?order_id=1106478587"
}
```

---

### 4. Webhook для обновлений от CDEK

**POST** `/api/delivery/webhook`

CDEK будет отправлять обновления на этот endpoint при изменении статуса заказа.

**Формат запроса от CDEK:**
```json
{
  "type": "ORDER_STATUS",
  "uuid": "72753031-...",
  "attributes": {
    "cdek_number": "1106478587",
    "code": "ACCEPTED_AT_PICK_UP_POINT",
    "name": "Прибыл в пункт выдачи",
    "date_time": "2024-03-25T15:30:00+03:00"
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "orderId": "uuid-заказа",
  "newStatus": "SHIPPED",
  "cdekStatus": "ACCEPTED_AT_PICK_UP_POINT"
}
```

---

## 🔄 Маппинг статусов CDEK → OrderStatus

| Статус CDEK | OrderStatus | Описание |
|-------------|-------------|----------|
| `CREATED`, `ACCEPTED` | `CONFIRMED` | Заказ создан и принят |
| `RECEIVED_AT_SHIPMENT_WAREHOUSE` | `PROCESSING` | На складе отправителя |
| `TAKEN_BY_TRANSPORTER_FROM_SENDER_CITY` | `SHIPPED` | Забран перевозчиком |
| `ACCEPTED_AT_PICK_UP_POINT` | `SHIPPED` | Прибыл в ПВЗ |
| `TAKEN_BY_COURIER` | `SHIPPED` | У курьера |
| `RECEIVED`, `DELIVERED` | `DELIVERED` | Вручён получателю |
| `NOT_DELIVERED` | `CANCELLED` | Не доставлен |
| `RETURNED` | `REFUNDED` | Возвращён отправителю |

---

## 📋 Процесс оформления заказа

### Шаг 1: Пользователь выбирает доставку

1. Выбирает страну → регион → город
2. Для CDEK выбирает тип: ПВЗ или курьер
3. Для ПВЗ выбирает конкретный пункт выдачи
4. Система рассчитывает стоимость доставки

### Шаг 2: Создание заказа

```typescript
// 1. Создать Order в вашей БД
const order = await prisma.order.create({
  data: {
    orderNumber: generateOrderNumber(),
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,

    // Сохраняем снэпшот адреса
    countryName: user.countryName,
    cityName: user.cityName,
    cdekCityCode: user.cdekCityCode,
    pickupPoint: selectedPickupPoint.code,

    deliveryType: 'CDEK_PICKUP',
    deliveryPrice: 268.78,

    paymentMethod: 'CARD_ONLINE',
    currency: 'RUB',

    subtotal: 2800,
    deliveryTotal: 268.78,
    total: 3068.78,

    status: 'PENDING',

    items: {
      create: cartItems.map(item => ({
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        price: item.price,
      })),
    },
  },
  include: { items: true },
});

// 2. После успешной оплаты создать заказ в CDEK
if (order.isPaid && order.deliveryType.startsWith('CDEK_')) {
  const cdekResult = await deliveryService.createCdekOrder({
    orderNumber: order.orderNumber,
    deliveryType: order.deliveryType,
    recipient: {
      firstName: order.firstName,
      lastName: order.lastName,
      phone: order.phone,
      email: order.email,
    },
    address: {
      cityCode: order.cdekCityCode,
      pickupPointCode: order.pickupPoint,
    },
    items: order.items.map(item => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      weight: 300, // Вес товара в граммах
    })),
  });

  // 3. Сохранить UUID заказа CDEK
  await prisma.order.update({
    where: { id: order.id },
    data: {
      cdekUuid: cdekResult.uuid,
      status: 'CONFIRMED',
    },
  });
}
```

### Шаг 3: Автоматическое обновление статусов

CDEK будет отправлять webhook'и при изменении статуса заказа. Ваш endpoint `/api/delivery/webhook` автоматически обновит статус в БД.

---

## 🔧 Настройка Webhook в CDEK

### Одноразовая регистрация

Нужно зарегистрировать ваш webhook URL в CDEK (выполнить один раз):

```bash
# Получить список зарегистрированных webhooks
curl -X GET https://api.edu.cdek.ru/v2/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN"

# Зарегистрировать новый webhook
curl -X POST https://api.edu.cdek.ru/v2/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourdomain.com/api/delivery/webhook",
    "type": "ORDER_STATUS"
  }'
```

**Важно:** Для тестовой среды используйте `https://api.edu.cdek.ru`, для боевой — `https://api.cdek.ru`.

---

## 🧪 Тестирование

### Тест создания заказа

```javascript
// test_create_cdek_order.js
const http = require('http');

const orderData = {
  orderNumber: 'TEST-' + Date.now(),
  deliveryType: 'CDEK_PICKUP',
  recipient: {
    firstName: 'Иван',
    lastName: 'Тестовый',
    phone: '+79001234567',
    email: 'test@example.com',
  },
  address: {
    cityCode: 44, // Москва
    pickupPointCode: 'MSK65',
  },
  items: [
    {
      name: 'Тестовый товар',
      sku: 'TEST-001',
      quantity: 1,
      price: 1000,
      weight: 500,
    },
  ],
};

const postData = JSON.stringify(orderData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/delivery/create-order',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', JSON.parse(data));
  });
});

req.on('error', (err) => {
  console.error('Error:', err);
});

req.write(postData);
req.end();
```

---

## 📊 Мониторинг заказов

### Получить все заказы с CDEK статусами

```sql
SELECT
  order_number,
  status,
  cdek_number,
  cdek_status_name,
  cdek_status_date,
  created_at
FROM orders
WHERE delivery_type IN ('CDEK_PICKUP', 'CDEK_COURIER')
ORDER BY created_at DESC;
```

### Найти заказы, ожидающие обновления статуса

```sql
SELECT * FROM orders
WHERE
  cdek_uuid IS NOT NULL
  AND cdek_status_date < NOW() - INTERVAL '24 hours'
  AND status NOT IN ('DELIVERED', 'CANCELLED', 'REFUNDED');
```

---

## ⚠️ Важные замечания

1. **Предоплата:** CDEK требует предоплаты. В `payment.value` указывайте `0` для уже оплаченных заказов.

2. **Вес товаров:** Указывайте реальный вес в граммах. Минимальный вес посылки — 500г.

3. **Тарифы:**
   - `136` — Посылка склад-склад (самовывоз)
   - `137` — Посылка склад-дверь (курьер)

4. **Webhook безопасность:** Рекомендуется добавить аутентификацию webhook через секретный ключ.

5. **Тестовая среда:** Заказы в тестовой среде CDEK не доставляются реально, но позволяют протестировать весь flow.

---

## 🎯 Следующие шаги

1. ✅ Модель Order создана
2. ✅ Методы для работы с CDEK реализованы
3. ✅ Webhook endpoint добавлен
4. ⏳ Интегрировать создание заказа в OrdersService
5. ⏳ Зарегистрировать webhook в CDEK
6. ⏳ Добавить уведомления пользователей о статусе
7. ⏳ Добавить админ-панель для управления заказами

---

**Дата:** 2024-03-25
**Версия:** 1.0
