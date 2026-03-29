# Admin API - Промокоды

## Создать промокод

**POST** `/api/admin/promo-codes`

```json
{
  "code": "SALE10",
  "type": "PERCENTAGE",
  "value": 10,
  "appliesTo": "ALL",
  "minOrderAmount": 5000,
  "maxUses": 100,
  "maxUsesPerUser": 1,
  "validUntil": "2026-12-31T23:59:59Z",
  "isActive": true
}
```

### Типы промокодов:
- `PERCENTAGE` - процентная скидка (value = 10 означает 10%)
- `FIXED` - фиксированная скидка в рублях (value = 500 означает 500₽)
- `FREE_DELIVERY` - бесплатная доставка

### Область применения:
- `ALL` - на все товары (по умолчанию)
- `PRODUCT` - только на конкретные товары (нужен specificProductIds)

### Опциональные поля:
- `specificProductIds` - массив ID товаров (только для appliesTo=PRODUCT)
- `excludedProductIds` - массив ID товаров-исключений
- `allowedUserIds` - массив UUID пользователей (пустой = для всех)
- `maxUses` - общий лимит использований
- `maxUsesPerUser` - лимит на одного пользователя
- `maxItems` - применяется только к N самым дорогим товарам
- `minOrderAmount` - минимальная сумма заказа в рублях
- `validFrom` - начало действия
- `validUntil` - конец действия
- `isActive` - активен ли промокод (по умолчанию true)

---

## Получить все промокоды

**GET** `/api/admin/promo-codes?isActive=true&page=1&limit=50`

**Query параметры:**
- `isActive` - фильтр по активности (true/false)
- `type` - фильтр по типу (PERCENTAGE/FIXED/FREE_DELIVERY)
- `page` - номер страницы
- `limit` - количество на странице

---

## Получить промокод по ID

**GET** `/api/admin/promo-codes/:id`

---

## Обновить промокод

**PUT** `/api/admin/promo-codes/:id`

```json
{
  "value": 15,
  "maxUses": 200,
  "isActive": true
}
```

---

## Удалить промокод

**DELETE** `/api/admin/promo-codes/:id`

---

## Деактивировать промокод

**POST** `/api/admin/promo-codes/:id/deactivate`

---

## Получить статистику использований

**GET** `/api/admin/promo-codes/:id/stats`

**Response:**
```json
{
  "promoCodeId": 1,
  "code": "SALE10",
  "maxUses": 100,
  "maxUsesPerUser": 1,
  "totalUsedCount": 25,
  "userStats": [
    {
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "Иван"
      },
      "usageCount": 1
    }
  ]
}
```

---

## Примеры создания промокодов

### 1. Скидка 10% на всё при заказе от 5000₽
```json
{
  "code": "SALE10",
  "type": "PERCENTAGE",
  "value": 10,
  "appliesTo": "ALL",
  "minOrderAmount": 5000,
  "isActive": true
}
```

### 2. Фиксированная скидка 500₽
```json
{
  "code": "SAVE500",
  "type": "FIXED",
  "value": 500,
  "appliesTo": "ALL",
  "isActive": true
}
```

### 3. Бесплатная доставка
```json
{
  "code": "FREESHIP",
  "type": "FREE_DELIVERY",
  "value": 0,
  "isActive": true
}
```

### 4. Скидка только на конкретные товары
```json
{
  "code": "JACKET20",
  "type": "PERCENTAGE",
  "value": 20,
  "appliesTo": "PRODUCT",
  "specificProductIds": [20, 21, 22],
  "isActive": true
}
```

### 5. Персональный промокод для конкретных пользователей
```json
{
  "code": "VIP50",
  "type": "PERCENTAGE",
  "value": 50,
  "appliesTo": "ALL",
  "allowedUserIds": ["uuid1", "uuid2"],
  "maxUsesPerUser": 1,
  "isActive": true
}
```

### 6. Скидка на 2 самых дорогих товара
```json
{
  "code": "TOP2SALE",
  "type": "PERCENTAGE",
  "value": 30,
  "appliesTo": "ALL",
  "maxItems": 2,
  "isActive": true
}
```

---

## Логика работы

1. **Несколько промокодов с одним кодом:** Может существовать несколько промокодов с одинаковым кодом, но только один активный
2. **Автоматическая генерация описания:** При создании генерируется человекочитаемое описание
3. **Проверка уникальности:** Система не даст создать активный промокод если уже есть активный с таким кодом
4. **Счетчик использований:** Автоматически увеличивается при каждом использовании
5. **История:** Все использования записываются в таблицу `promo_code_usage`
