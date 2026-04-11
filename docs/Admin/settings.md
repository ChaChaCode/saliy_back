# API админ-панели: Настройки сайта

**Базовый URL:** `/api/admin/settings`

**Требуется авторизация:** Admin Bearer Token

Универсальное key-value хранилище настроек. Значения автоматически распаршиваются из JSON (числа, строки, объекты, массивы).

---

## Стандартные ключи настроек

| Ключ | Назначение | Значение по умолчанию |
|------|------------|-----------------------|
| `delivery_price_cdek` | Цена самовывоза CDEK (₽) | `500` |
| `delivery_price_standard` | Цена почтовой доставки (₽) | `800` |
| `low_stock_threshold` | Порог низкого остатка | `5` |
| `site_name` | Название сайта | `"Saliy Clothes"` |
| `contact_email` | Контактный email | `"info@saliy-shop.ru"` |

> Список расширяется. Можно добавлять любые произвольные ключи.

---

## 1. Получить все настройки

**GET** `/api/admin/settings`

### Response:
```json
[
  { "key": "delivery_price_cdek", "value": 500, "description": "Цена самовывоза CDEK в рублях", "updatedAt": "..." },
  { "key": "delivery_price_standard", "value": 800, "description": "...", "updatedAt": "..." },
  { "key": "site_name", "value": "Saliy Clothes", "description": "Название сайта", "updatedAt": "..." }
]
```

---

## 2. Получить настройку

**GET** `/api/admin/settings/:key`

### Response:
```json
{
  "key": "delivery_price_cdek",
  "value": 500,
  "description": "Цена самовывоза CDEK в рублях",
  "updatedAt": "2026-04-11T10:00:00.000Z"
}
```

---

## 3. Создать / обновить настройку

**PUT** `/api/admin/settings/:key`

Upsert — создаёт, если нет; обновляет, если есть.

### Request:
```json
{
  "value": 600,
  "description": "Новая цена самовывоза (повышение)"
}
```

### Пример — обновить цену доставки:
```bash
curl -X PUT https://saliy-shop.ru/api/admin/settings/delivery_price_cdek \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": 600}'
```

Значение `value` принимает любой JSON-тип (число, строка, объект, массив, булево).

---

## 4. Удалить настройку

**DELETE** `/api/admin/settings/:key`

### Response:
```json
{ "success": true }
```

---

## Важно: цены доставки

Цены доставки раньше были захардкожены в коде [src/orders/orders.service.ts](src/orders/orders.service.ts). Теперь они берутся из `Settings`.

**При расчёте стоимости заказа** в `POST /api/orders/calculate` сервер читает настройки `delivery_price_cdek` и `delivery_price_standard` каждый раз — изменения применяются немедленно, без редеплоя.
