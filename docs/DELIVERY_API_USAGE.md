# Delivery API - Руководство по использованию

## Эндпоинты для работы со странами доставки

### 1. Получить список всех стран

**Endpoint:** `GET /delivery/countries`

**Query Parameters:**
- `lang` (optional) - язык для названий стран. Доступные значения: `ru`, `en`, `pl`. По умолчанию: `ru`

**Пример запроса:**
```bash
# Получить список стран на русском языке
GET http://localhost:3000/delivery/countries?lang=ru

# Получить список стран на английском языке
GET http://localhost:3000/delivery/countries?lang=en

# Получить список стран на польском языке
GET http://localhost:3000/delivery/countries?lang=pl
```

**Пример ответа:**
```json
{
  "countries": [
    {
      "code": "RU",
      "name": "Россия",
      "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
    },
    {
      "code": "BY",
      "name": "Беларусь",
      "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
    },
    {
      "code": "PL",
      "name": "Польша",
      "deliveryTypes": ["STANDARD"]
    },
    {
      "code": "US",
      "name": "Соединенные Штаты",
      "deliveryTypes": ["STANDARD"]
    }
    // ... остальные страны
  ]
}
```

**Типы доставки:**
- `CDEK_PICKUP` - самовывоз из пункта выдачи СДЭК (только для RU и BY)
- `CDEK_COURIER` - курьерская доставка СДЭК (только для RU и BY)
- `STANDARD` - стандартная доставка (для всех стран)

---

### 2. Получить информацию о конкретной стране

**Endpoint:** `GET /delivery/countries/:code`

**Path Parameters:**
- `code` (required) - код страны в формате ISO Alpha-2 (например, `RU`, `BY`, `PL`)

**Query Parameters:**
- `lang` (optional) - язык для названия страны. По умолчанию: `ru`

**Пример запроса:**
```bash
# Получить информацию о России
GET http://localhost:3000/delivery/countries/RU?lang=ru

# Получить информацию о США на английском
GET http://localhost:3000/delivery/countries/US?lang=en
```

**Пример ответа (успешный):**
```json
{
  "code": "RU",
  "name": "Россия",
  "deliveryTypes": ["CDEK_PICKUP", "CDEK_COURIER", "STANDARD"]
}
```

**Пример ответа (страна не найдена):**
```json
{
  "error": "Country not found"
}
```

---

### 3. Получить список регионов страны

**Endpoint:** `GET /delivery/regions`

**Query Parameters:**
- `countryCode` (required) - код страны в формате ISO Alpha-2 (например, `RU`, `BY`)

**Пример запроса:**
```bash
# Получить регионы России
GET http://localhost:3000/delivery/regions?countryCode=RU

# Получить регионы Беларуси
GET http://localhost:3000/delivery/regions?countryCode=BY
```

**Пример ответа:**
```json
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
    },
    {
      "code": 23,
      "name": "Краснодарский",
      "countryCode": "RU"
    }
  ]
}
```

---

### 4. Получить список городов региона

**Endpoint:** `GET /delivery/cities`

**Query Parameters:**
- `countryCode` (required) - код страны
- `regionCode` (optional) - код региона для фильтрации
- `search` (optional) - поиск по названию города

**Пример запроса:**
```bash
# Получить все города Москвы (регион 77)
GET http://localhost:3000/delivery/cities?countryCode=RU&regionCode=77

# Поиск городов по названию
GET http://localhost:3000/delivery/cities?countryCode=RU&search=Москва

# Все города России (без фильтра по региону)
GET http://localhost:3000/delivery/cities?countryCode=RU
```

**Пример ответа:**
```json
{
  "cities": [
    {
      "code": 44,
      "name": "Москва",
      "regionCode": 77,
      "region": "Москва",
      "countryCode": "RU"
    },
    {
      "code": 270,
      "name": "Санкт-Петербург",
      "regionCode": 78,
      "region": "Санкт-Петербург",
      "countryCode": "RU"
    }
  ]
}
```

---

### 5. Получить список пунктов выдачи CDEK

**Endpoint:** `GET /delivery/pickup-points`

**Query Parameters:**
- `cityCode` (required) - код города CDEK

**Пример запроса:**
```bash
# Получить пункты выдачи в Москве (код 44)
GET http://localhost:3000/delivery/pickup-points?cityCode=44

# Получить пункты выдачи в Минске (код 9220)
GET http://localhost:3000/delivery/pickup-points?cityCode=9220
```

**Пример ответа:**
```json
{
  "points": [
    {
      "code": "MSK123",
      "name": "СДЭК на Ленинском",
      "address": "г. Москва, Ленинский проспект, д. 1",
      "city": "Москва",
      "coordinates": [37.5, 55.7],
      "workTime": "Пн-Пт 9:00-21:00, Сб 10:00-18:00",
      "phones": ["+74951234567"],
      "isDressingRoom": true,
      "haveCashless": true
    },
    {
      "code": "MSK456",
      "name": "СДЭК на Тверской",
      "address": "г. Москва, ул. Тверская, д. 10",
      "city": "Москва",
      "coordinates": [37.6, 55.75],
      "workTime": "Пн-Вс 9:00-22:00",
      "phones": ["+74959876543"],
      "isDressingRoom": false,
      "haveCashless": true
    }
  ]
}
```

**Поля ответа:**
- `code` - уникальный код пункта выдачи (нужен для создания заказа)
- `name` - название пункта выдачи
- `address` - полный адрес
- `coordinates` - [longitude, latitude] для отображения на карте
- `workTime` - график работы
- `isDressingRoom` - наличие примерочной
- `haveCashless` - возможность безналичной оплаты

---

### 6. Рассчитать стоимость доставки

**Endpoint:** `GET /delivery/prices`

**Query Parameters:**
- `cityCode` (required) - код города CDEK
- `weight` (optional) - вес посылки в граммах. По умолчанию: 500
- `currency` (optional) - валюта для расчёта. По умолчанию: RUB

**Пример запроса:**
```bash
# Рассчитать доставку в Москву (вес 500г)
GET http://localhost:3000/delivery/prices?cityCode=44&weight=500&currency=RUB

# Рассчитать доставку в Минск (вес 1000г)
GET http://localhost:3000/delivery/prices?cityCode=9220&weight=1000&currency=RUB
```

**Пример ответа:**
```json
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

**Поля ответа:**
- `tariffCode` - код тарифа CDEK
- `tariffName` - название тарифа
- `deliverySum` - стоимость доставки
- `periodMin/periodMax` - срок доставки в днях
- `currency` - валюта

---

## Интеграция с фронтендом

### Полный Flow оформления заказа с CDEK

```typescript
import { useState, useEffect } from 'react';

interface Country {
  code: string;
  name: string;
  deliveryTypes: string[];
}

interface Region {
  code: number;
  name: string;
  countryCode: string;
}

interface City {
  code: number;
  name: string;
  regionCode: number;
  region: string;
  countryCode: string;
}

interface PickupPoint {
  code: string;
  name: string;
  address: string;
  coordinates: [number, number];
  workTime: string;
  isDressingRoom: boolean;
}

interface DeliveryPrice {
  tariffCode: number;
  tariffName: string;
  deliverySum: number;
  periodMin: number;
  periodMax: number;
  currency: string;
}

function CheckoutDeliveryForm() {
  // Шаг 1: Выбор страны
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  // Шаг 2: Выбор региона (только для CDEK стран)
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);

  // Шаг 3: Выбор города
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  // Шаг 4: Расчёт стоимости доставки
  const [deliveryPrices, setDeliveryPrices] = useState<{
    pickup: DeliveryPrice | null;
    courier: DeliveryPrice | null;
  } | null>(null);
  const [deliveryType, setDeliveryType] = useState<'CDEK_PICKUP' | 'CDEK_COURIER' | 'STANDARD' | null>(null);

  // Шаг 5: Выбор пункта выдачи (если CDEK_PICKUP)
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<PickupPoint | null>(null);

  // Загрузка стран при монтировании
  useEffect(() => {
    fetch('/delivery/countries?lang=ru')
      .then(res => res.json())
      .then(data => setCountries(data.countries));
  }, []);

  // Загрузка регионов при выборе страны
  useEffect(() => {
    if (selectedCountry && selectedCountry.deliveryTypes.includes('CDEK_PICKUP')) {
      fetch(`/delivery/regions?countryCode=${selectedCountry.code}`)
        .then(res => res.json())
        .then(data => setRegions(data.regions));
    }
  }, [selectedCountry]);

  // Загрузка городов при выборе региона
  useEffect(() => {
    if (selectedCountry && selectedRegion) {
      fetch(`/delivery/cities?countryCode=${selectedCountry.code}&regionCode=${selectedRegion.code}`)
        .then(res => res.json())
        .then(data => setCities(data.cities));
    }
  }, [selectedCountry, selectedRegion]);

  // Расчёт стоимости доставки при выборе города
  useEffect(() => {
    if (selectedCity && selectedCountry?.deliveryTypes.includes('CDEK_PICKUP')) {
      fetch(`/delivery/prices?cityCode=${selectedCity.code}&weight=500&currency=RUB`)
        .then(res => res.json())
        .then(data => setDeliveryPrices(data));
    }
  }, [selectedCity]);

  // Загрузка пунктов выдачи при выборе типа доставки "Самовывоз"
  useEffect(() => {
    if (deliveryType === 'CDEK_PICKUP' && selectedCity) {
      fetch(`/delivery/pickup-points?cityCode=${selectedCity.code}`)
        .then(res => res.json())
        .then(data => setPickupPoints(data.points));
    }
  }, [deliveryType, selectedCity]);

  return (
    <div>
      {/* Шаг 1: Выбор страны */}
      <div>
        <label>Страна доставки:</label>
        <select
          value={selectedCountry?.code || ''}
          onChange={(e) => {
            const country = countries.find(c => c.code === e.target.value);
            setSelectedCountry(country || null);
            setSelectedRegion(null);
            setSelectedCity(null);
            setDeliveryType(null);
          }}
        >
          <option value="">Выберите страну</option>
          {countries.map(country => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </div>

      {/* Шаг 2: Выбор региона (только для CDEK) */}
      {selectedCountry?.deliveryTypes.includes('CDEK_PICKUP') && (
        <div>
          <label>Регион:</label>
          <select
            value={selectedRegion?.code || ''}
            onChange={(e) => {
              const region = regions.find(r => r.code === Number(e.target.value));
              setSelectedRegion(region || null);
              setSelectedCity(null);
            }}
          >
            <option value="">Выберите регион</option>
            {regions.map(region => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Шаг 3: Выбор города */}
      {selectedRegion && (
        <div>
          <label>Город:</label>
          <select
            value={selectedCity?.code || ''}
            onChange={(e) => {
              const city = cities.find(c => c.code === Number(e.target.value));
              setSelectedCity(city || null);
            }}
          >
            <option value="">Выберите город</option>
            {cities.map(city => (
              <option key={city.code} value={city.code}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Шаг 4: Выбор типа доставки и отображение цены */}
      {deliveryPrices && (
        <div>
          <h3>Способ доставки:</h3>

          {deliveryPrices.pickup && (
            <label>
              <input
                type="radio"
                name="deliveryType"
                value="CDEK_PICKUP"
                onChange={() => setDeliveryType('CDEK_PICKUP')}
              />
              Самовывоз из пункта выдачи СДЭК - {deliveryPrices.pickup.deliverySum} ₽
              <small> (доставка за {deliveryPrices.pickup.periodMin}-{deliveryPrices.pickup.periodMax} дней)</small>
            </label>
          )}

          {deliveryPrices.courier && (
            <label>
              <input
                type="radio"
                name="deliveryType"
                value="CDEK_COURIER"
                onChange={() => setDeliveryType('CDEK_COURIER')}
              />
              Курьерская доставка СДЭК - {deliveryPrices.courier.deliverySum} ₽
              <small> (доставка за {deliveryPrices.courier.periodMin}-{deliveryPrices.courier.periodMax} дней)</small>
            </label>
          )}
        </div>
      )}

      {/* Шаг 5: Выбор пункта выдачи (если CDEK_PICKUP) */}
      {deliveryType === 'CDEK_PICKUP' && pickupPoints.length > 0 && (
        <div>
          <h3>Выберите пункт выдачи:</h3>
          <select
            value={selectedPickupPoint?.code || ''}
            onChange={(e) => {
              const point = pickupPoints.find(p => p.code === e.target.value);
              setSelectedPickupPoint(point || null);
            }}
          >
            <option value="">Выберите пункт выдачи</option>
            {pickupPoints.map(point => (
              <option key={point.code} value={point.code}>
                {point.name} - {point.address}
                {point.isDressingRoom && ' (есть примерочная)'}
              </option>
            ))}
          </select>

          {selectedPickupPoint && (
            <div>
              <p><strong>Адрес:</strong> {selectedPickupPoint.address}</p>
              <p><strong>График работы:</strong> {selectedPickupPoint.workTime}</p>
              {selectedPickupPoint.isDressingRoom && <p>✓ Есть примерочная</p>}
            </div>
          )}
        </div>
      )}

      {/* Шаг 6: Ввод адреса (если CDEK_COURIER) */}
      {deliveryType === 'CDEK_COURIER' && (
        <div>
          <h3>Адрес доставки:</h3>
          <input type="text" placeholder="Улица, дом" />
          <input type="text" placeholder="Квартира/офис" />
          <input type="text" placeholder="Почтовый индекс" />
        </div>
      )}
    </div>
  );
}
```

### Пример использования с Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Получить список стран
export const getCountries = async (lang: string = 'ru') => {
  const response = await api.get(`/delivery/countries?lang=${lang}`);
  return response.data.countries;
};

// Получить информацию о стране
export const getCountryInfo = async (code: string, lang: string = 'ru') => {
  const response = await api.get(`/delivery/countries/${code}?lang=${lang}`);
  return response.data;
};

// Проверить, поддерживает ли страна CDEK
export const isCdekSupported = (country: Country) => {
  return country.deliveryTypes.includes('CDEK_PICKUP') ||
         country.deliveryTypes.includes('CDEK_COURIER');
};
```

---

## Поддерживаемые языки

API поддерживает следующие языки для названий стран:

- `ru` - Русский
- `en` - English (Английский)
- `pl` - Polski (Польский)

Вы можете легко добавить поддержку дополнительных языков, зарегистрировав соответствующие локали в `delivery.service.ts`:

```typescript
countries.registerLocale(require('i18n-iso-countries/langs/de.json')); // Немецкий
countries.registerLocale(require('i18n-iso-countries/langs/fr.json')); // Французский
countries.registerLocale(require('i18n-iso-countries/langs/es.json')); // Испанский
```

---

## Особенности

### CDEK интеграция

Страны **RU (Россия)** и **BY (Беларусь)** поддерживают расширенные возможности доставки через CDEK:

1. **CDEK_PICKUP** - самовывоз из пунктов выдачи:
   - Необходимо будет выбрать конкретный пункт выдачи
   - Доступен расчет стоимости доставки
   - Отслеживание посылки

2. **CDEK_COURIER** - курьерская доставка:
   - Доставка по адресу
   - Необходимо указать полный адрес (город, улица, дом, квартира)
   - Расчет стоимости доставки

### Стандартная доставка

Для всех остальных стран доступна только **STANDARD** доставка:
- Фиксированная стоимость доставки
- Указывается текстовый адрес
- Ручная обработка заказа менеджером

---

## Примеры использования в разных сценариях

### Сценарий 1: Выбор страны с проверкой типа доставки

```typescript
const country = await getCountryInfo('RU', 'ru');

if (country.deliveryTypes.includes('CDEK_PICKUP')) {
  // Показываем форму выбора пункта выдачи CDEK
  showCdekPickupForm();
} else if (country.deliveryTypes.includes('STANDARD')) {
  // Показываем форму ввода адреса доставки
  showStandardDeliveryForm();
}
```

### Сценарий 2: Фильтрация стран по типу доставки

```typescript
const countries = await getCountries('ru');

// Только страны с CDEK
const cdekCountries = countries.filter(c =>
  c.deliveryTypes.includes('CDEK_PICKUP')
);

// Только страны со стандартной доставкой
const standardCountries = countries.filter(c =>
  c.deliveryTypes.includes('STANDARD') &&
  !c.deliveryTypes.includes('CDEK_PICKUP')
);
```

### Сценарий 3: Мультиязычность

```typescript
const [currentLang, setCurrentLang] = useState('ru');

// При смене языка в приложении
const changeLanguage = (newLang: 'ru' | 'en' | 'pl') => {
  setCurrentLang(newLang);
  // Автоматически перезагрузит список стран на новом языке
};
```

---

## Тестирование API

### С помощью curl:

```bash
# Получить список стран на русском
curl -X GET "http://localhost:3000/delivery/countries?lang=ru"

# Получить список стран на английском
curl -X GET "http://localhost:3000/delivery/countries?lang=en"

# Получить информацию о России
curl -X GET "http://localhost:3000/delivery/countries/RU?lang=ru"

# Получить информацию о несуществующей стране
curl -X GET "http://localhost:3000/delivery/countries/XX?lang=ru"
```

### С помощью Postman/Thunder Client:

1. **Запрос:** GET `http://localhost:3000/delivery/countries`
   - **Query Params:** `lang` = `ru`
   - **Expected Status:** 200 OK

2. **Запрос:** GET `http://localhost:3000/delivery/countries/RU`
   - **Query Params:** `lang` = `ru`
   - **Expected Status:** 200 OK

3. **Запрос:** GET `http://localhost:3000/delivery/countries/XX`
   - **Expected Response:** `{ "error": "Country not found" }`

---

## Следующие шаги

После настройки работы со странами, следующие шаги включают:

1. **Интеграция с CDEK API:**
   - Добавить эндпоинты для получения регионов (`GET /delivery/regions`)
   - Добавить эндпоинты для получения городов (`GET /delivery/cities`)
   - Добавить эндпоинты для получения пунктов выдачи (`GET /delivery/pickup-points`)
   - Добавить расчет стоимости доставки (`GET /delivery/prices`)

2. **Создание заказов:**
   - Создать модель Order в Prisma
   - Реализовать создание заказа с адресом доставки
   - Интегрировать с платежными системами

3. **Управление профилем пользователя:**
   - Добавить эндпоинты для сохранения адреса доставки в профиле
   - Автоматическое заполнение формы адреса для авторизованных пользователей

---

**Версия:** 1.0
**Дата:** 2026-03-25
**Автор:** Saliy Backend Team
