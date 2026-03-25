# Система доставки — Quick Start

## Быстрый старт для интеграции

### 1. Минимальные поля в БД

**User (профиль):**
```prisma
cdekCityCode      Int?     // Код города СДЭК
cdekCountryCode   String?  // RU, BY, PL, ...
cityName          String?  // "Москва"
countryName       String?  // "Россия"
street            String?  // "Ленинский проспект, д. 1"
apartment         String?  // "42"
postalCode        String?  // "119991"
```

**Order (заказ):**
```prisma
cdekCityCode      Int?
cityName          String?
countryName       String?
street            String?
apartment         String?
pickupPoint       String?     // Код ПВЗ СДЭК
deliveryType      DeliveryType
deliveryPrice     Float
cdekUuid          String?     // UUID заказа в СДЭК
cdekNumber        String?     // Номер заказа СДЭК
```

---

## 2. API Flow (фронтенд)

### Для СДЭК стран (RU/BY):

```typescript
// Шаг 1: Получить страны
const { countries } = await GET('/delivery/countries?lang=ru');

// Шаг 2: Получить регионы
const { regions } = await GET('/delivery/regions?countryCode=RU');

// Шаг 3: Получить города
const { cities } = await GET('/delivery/cities?countryCode=RU&regionCode=77');

// Шаг 4: Рассчитать доставку
const prices = await GET('/delivery/prices?cityCode=44&weight=500&currency=RUB');
// → { pickup: { deliverySum: 250 }, courier: { deliverySum: 400 } }

// Шаг 5: Если ПВЗ — получить список
const { points } = await GET('/delivery/pickup-points?cityCode=44');

// Шаг 6: Создать заказ
const order = await POST('/orders', {
  contactInfo: { firstName, lastName, phone, email },
  deliveryInfo: {
    deliveryType: 'CDEK_PICKUP',
    countryCode: 'RU',
    city: 'Москва',
    cityId: 44,
    pickupPoint: 'MSK123',
    deliveryPrice: 250
  },
  paymentInfo: { paymentMethod: 'CARD_ONLINE', currency: 'RUB' },
  guestCart: [{ productId: 1, color: 'black', size: 'M', quantity: 1 }]
});

// Шаг 7: Редирект
if (order.paymentUrl) window.location.href = order.paymentUrl;
```

### Для остальных стран (STANDARD):

```typescript
// Шаг 1: Страна (без СДЭК)
const { countries } = await GET('/delivery/countries?lang=ru');

// Шаг 2: Создать заказ (текстовый адрес)
const order = await POST('/orders', {
  contactInfo: { firstName, lastName, phone, email },
  deliveryInfo: {
    deliveryType: 'STANDARD',
    countryCode: 'PL',
    country: 'Polska',
    city: 'Warszawa',
    street: 'ul. Marszałkowska 1',
    apartment: '10',
    postalCode: '00-001',
    deliveryPrice: 1500
  },
  paymentInfo: { paymentMethod: 'BLIK', currency: 'PLN' },
  guestCart: [...]
});
```

---

## 3. Backend (создание заказа)

```typescript
// orders.service.ts

async createOrder(userId: string | null, dto: CreateOrderDto) {
  // 1. Создать заказ в БД
  const order = await this.prisma.order.create({
    data: {
      orderNumber: this.generateOrderNumber(),
      userId: userId ? parseInt(userId) : null,

      // Контакты
      firstName: dto.contactInfo.firstName,
      lastName: dto.contactInfo.lastName,
      phone: dto.contactInfo.phone,
      email: dto.contactInfo.email,

      // Адрес (снимок на момент заказа)
      cdekCityCode: dto.deliveryInfo.cityId,
      cityName: dto.deliveryInfo.city,
      countryName: dto.deliveryInfo.country,
      street: dto.deliveryInfo.street,
      apartment: dto.deliveryInfo.apartment,
      postalCode: dto.deliveryInfo.postalCode,
      pickupPoint: dto.deliveryInfo.pickupPoint,

      // Доставка
      deliveryType: dto.deliveryInfo.deliveryType,
      deliveryPrice: dto.deliveryInfo.deliveryPrice,

      // Оплата
      paymentMethod: dto.paymentInfo.paymentMethod,
      currency: dto.paymentInfo.currency || 'RUB',

      // Суммы
      subtotal: calculateSubtotal(items),
      total: calculateTotal(items, dto.deliveryInfo.deliveryPrice),

      status: 'PENDING',
      items: { create: items }
    }
  });

  // 2. Если СДЭК — создать заказ в СДЭК
  if (dto.deliveryInfo.deliveryType === 'CDEK_PICKUP' || dto.deliveryInfo.deliveryType === 'CDEK_COURIER') {
    const cdekOrder = await this.deliveryService.createCdekOrder({
      orderNumber: order.orderNumber,
      deliveryType: dto.deliveryInfo.deliveryType,
      recipient: {
        firstName: dto.contactInfo.firstName,
        lastName: dto.contactInfo.lastName,
        phone: dto.contactInfo.phone,
        email: dto.contactInfo.email
      },
      address: {
        cityCode: dto.deliveryInfo.cityId,
        street: dto.deliveryInfo.street,
        apartment: dto.deliveryInfo.apartment,
        pickupPointCode: dto.deliveryInfo.pickupPoint
      },
      items: order.items.map(item => ({
        name: item.productName,
        sku: item.productSlug,
        quantity: item.quantity,
        price: item.price,
        weight: 200 // грамм
      }))
    });

    // Сохранить UUID СДЭК
    await this.prisma.order.update({
      where: { id: order.id },
      data: { cdekUuid: cdekOrder.uuid }
    });
  }

  return order;
}
```

---

## 4. Конфигурация (ENV)

```env
# CDEK
CDEK_TEST_MODE=true
CDEK_CLIENT_ID=<ID>
CDEK_CLIENT_SECRET=<секрет>
CDEK_WAREHOUSE_CITY_CODE=9220  # Минск

# Production
CDEK_TEST_MODE=false
```

**Получить credentials:**
- Test: https://edu.cdek.ru/integration/
- Prod: https://www.cdek.ru/ru/integration/api

---

## 5. Файлы для копирования

### Prisma схемы:
```bash
prisma/schema/user.prisma      # Поля: cdekCityCode, cityName, street, ...
prisma/schema/order.prisma     # Поля: cdekCityCode, cityName, cdekUuid, ...
prisma/schema/_enums.prisma    # DeliveryType, PaymentMethod, OrderStatus
```

### Сервисы:
```bash
src/orders/delivery.service.ts       # СДЭК API (страны, города, ПВЗ, тарифы)
src/orders/delivery.controller.ts    # Endpoints /delivery/*
src/orders/dto/delivery.dto.ts       # DTO для доставки
src/orders/dto/create-order.dto.ts   # DTO для создания заказа
```

---

## 6. Ключевые endpoints

| Endpoint | Описание |
|----------|----------|
| `GET /delivery/countries` | Список стран + типы доставки |
| `GET /delivery/regions?countryCode=RU` | Регионы страны |
| `GET /delivery/cities?countryCode=RU&regionCode=77` | Города региона |
| `GET /delivery/pickup-points?cityCode=44` | ПВЗ СДЭК |
| `GET /delivery/prices?cityCode=44&weight=500&currency=RUB` | Стоимость доставки |
| `POST /orders` | Создать заказ |
| `POST /delivery/cdek-webhook` | Webhook от СДЭК |

---

## 7. Webhook СДЭК (автообновление статусов)

### Регистрация (один раз):
```bash
POST /delivery/cdek-webhook/register
Body: { "url": "https://api.yourdomain.com/delivery/cdek-webhook" }
```

### Обработка:
```typescript
// delivery.controller.ts
@Post('cdek-webhook')
async handleCdekWebhook(@Body() payload: any) {
  // payload.type === 'ORDER_STATUS'
  // payload.uuid === UUID заказа СДЭК
  // payload.attributes.code === 'RECEIVED' (статус)

  const result = await this.deliveryService.handleCdekWebhook(payload);
  return { success: true, ...result };
}
```

**Маппинг статусов:**
- `CREATED`, `ACCEPTED` → `CONFIRMED`
- `RECEIVED_AT_SHIPMENT_WAREHOUSE` → `PROCESSING`
- `SENT_TO_RECIPIENT_CITY` → `SHIPPED`
- `RECEIVED`, `DELIVERED` → `DELIVERED`

---

## 8. Примеры использования

### React Hook:

```typescript
// useDelivery.ts
export function useDelivery() {
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [deliveryPrices, setDeliveryPrices] = useState(null);

  const loadCountries = async () => {
    const res = await fetch('/delivery/countries?lang=ru');
    setCountries((await res.json()).countries);
  };

  const loadCities = async (countryCode: string, regionCode?: number) => {
    const url = `/delivery/cities?countryCode=${countryCode}${regionCode ? `&regionCode=${regionCode}` : ''}`;
    const res = await fetch(url);
    setCities((await res.json()).cities);
  };

  const calculateDelivery = async (cityCode: number, weight: number) => {
    const res = await fetch(`/delivery/prices?cityCode=${cityCode}&weight=${weight}&currency=RUB`);
    setDeliveryPrices(await res.json());
  };

  return { countries, cities, deliveryPrices, loadCountries, loadCities, calculateDelivery };
}
```

### Компонент:

```tsx
function CheckoutForm() {
  const { countries, cities, deliveryPrices, loadCountries, loadCities, calculateDelivery } = useDelivery();
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  useEffect(() => { loadCountries(); }, []);

  useEffect(() => {
    if (selectedCountry?.code) {
      loadCities(selectedCountry.code);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedCity?.code) {
      calculateDelivery(selectedCity.code, 500);
    }
  }, [selectedCity]);

  return (
    <form>
      <select onChange={(e) => setSelectedCountry(countries.find(c => c.code === e.target.value))}>
        {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>

      {selectedCountry?.deliveryTypes.includes('CDEK_PICKUP') && (
        <>
          <select onChange={(e) => setSelectedCity(cities.find(c => c.code === +e.target.value))}>
            {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>

          {deliveryPrices && (
            <div>
              <p>ПВЗ: {deliveryPrices.pickup?.deliverySum} ₽</p>
              <p>Курьер: {deliveryPrices.courier?.deliverySum} ₽</p>
            </div>
          )}
        </>
      )}

      {selectedCountry && !selectedCountry.deliveryTypes.includes('CDEK_PICKUP') && (
        <>
          <input placeholder="Город" />
          <input placeholder="Улица, дом" />
          <input placeholder="Квартира/офис" />
          <input placeholder="Индекс" />
        </>
      )}
    </form>
  );
}
```

---

## 9. Чек-лист внедрения

- [ ] Добавить поля в `User` и `Order` (Prisma)
- [ ] Скопировать `DeliveryService` и `DeliveryController`
- [ ] Настроить ENV (CDEK credentials)
- [ ] Зарегистрировать модули в `AppModule`
- [ ] Создать endpoints `/delivery/*`
- [ ] Интегрировать в `OrdersService.createOrder()`
- [ ] Зарегистрировать webhook СДЭК
- [ ] Протестировать на тестовой среде
- [ ] Реализовать фронтенд (селекты + карта ПВЗ)

---

## 10. Готовые компоненты (для фронтенда)

### Карта ПВЗ (Leaflet):

```tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

function PickupPointsMap({ points, onSelect }) {
  return (
    <MapContainer center={[55.7558, 37.6173]} zoom={10} style={{ height: '400px' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map(point => (
        <Marker key={point.code} position={point.coordinates}>
          <Popup>
            <strong>{point.name}</strong>
            <p>{point.address}</p>
            <button onClick={() => onSelect(point)}>Выбрать</button>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

---

## Полезные ссылки

- 📖 **Полная документация:** `DELIVERY_SYSTEM.md`
- 🔗 **СДЭК API:** https://api-docs.cdek.ru/
- 🧪 **Тестовая среда:** https://edu.cdek.ru/
- 📍 **Трекинг:** https://www.cdek.ru/ru/tracking

---

**Автор:** ViceSeason Backend Team
**Версия:** 1.0
