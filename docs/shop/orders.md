# API заказов

## 1. Получить доступные опции доставки и оплаты

**GET** `/api/orders/delivery-options?country=RU`

Возвращает доступные типы доставки и методы оплаты для выбранной страны.

### Query параметры:
- `country` - Код страны (RU, BY, PL, и т.д.)

### Правила:
- **Россия и Беларусь (RU, BY):** только `CDEK_PICKUP` (самовывоз из ПВЗ)
- **Другие страны:** только `STANDARD` (почтовая доставка)
- **Все страны:** только `CARD_ONLINE` (Яндекс Пей, фейковая оплата - сразу проходит)

### Примеры запросов:

**Россия:**
```bash
curl "https://saliy-shop.ru/api/orders/delivery-options?country=RU"
```

**Response:**
```json
{
  "deliveryTypes": ["CDEK_PICKUP"],
  "paymentMethods": ["CARD_ONLINE"],
  "country": "RU"
}
```

**Польша:**
```bash
curl "https://saliy-shop.ru/api/orders/delivery-options?country=PL"
```

**Response:**
```json
{
  "deliveryTypes": ["STANDARD"],
  "paymentMethods": ["CARD_ONLINE"],
  "country": "PL"
}
```

---

## 2. Рассчитать стоимость заказа

**POST** `/api/orders/calculate`

Рассчитывает итоговую стоимость заказа БЕЗ его создания.
Используется для отображения итоговой суммы перед кнопкой "Оплатить".

### Request:
```json
{
  "items": [
    {"productId": 20, "size": "M", "quantity": 1}
  ],
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "socialContact": "Telegram: @ivan_petrov",
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE",
  "promoCode": "SALE10"
}
```

### Response:
```json
{
  "items": [
    {
      "productId": 20,
      "productName": "Джинсовка SALIY чёрная",
      "productSlug": "dzhinsovka-saliy-black",
      "size": "M",
      "color": "black",
      "quantity": 1,
      "price": 9500,
      "discount": 10,
      "finalPrice": 8550,
      "totalPrice": 8550,
      "imageUrl": {
        "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
        "isPreview": true,
        "previewOrder": 1
      }
    }
  ],
  "originalSubtotal": 9500,
  "productDiscountAmount": 950,
  "subtotal": 8550,
  "discountAmount": 855,
  "promoCode": "SALE10",
  "deliveryPrice": 800,
  "total": 8495,
  "currency": "RUB"
}
```

### Поля расчёта цены:
- **originalSubtotal** — сумма товаров без каких-либо скидок
- **productDiscountAmount** — сколько сэкономлено на скидках самих товаров
- **subtotal** — сумма после скидок на товары (до промокода и доставки)
- **discountAmount** — скидка от промокода (в рублях)
- **promoCode** — применённый промокод (null если не использовался)
- **deliveryPrice** — стоимость доставки
- **total** — итоговая сумма к оплате (`subtotal - discountAmount + deliveryPrice`)

---

## 3. Создать заказ

**POST** `/api/orders`

Создает заказ и сразу подтверждает оплату.
Отправляется email с подтверждением заказа.

**Формат номера заказа:** `SALIYYYMMDDXXXXX`
- SALIY - префикс бренда
- YY - год (26 для 2026)
- MM - месяц (01-12)
- DD - день (01-31)
- XXXXX - уникальный 5-значный порядковый номер за день

Пример: `SALIY2603300001` (первый заказ за 30 марта 2026)

### Важно:
- ✅ Цены берутся из БД, не от клиента!
- ✅ Проверяется наличие товара на складе
- ✅ Заказы сразу оплачены (isPaid = true, status = CONFIRMED)
- ✅ Уменьшаются остатки на складе
- ✅ Работает для гостей и авторизованных пользователей

### Request:
```json
{
  "items": [
    {"productId": 20, "size": "M", "quantity": 1}
  ],
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "socialContact": "Telegram: @ivan_petrov",
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE",
  "promoCode": "SALE10",
  "comment": "Пожалуйста, упакуйте в подарочную упаковку"
}
```

### Новое поле для связи:
- `socialContact` - Контакт в соц. сети (опционально)
  - Примеры: "Telegram: @ivan_petrov" или "Instagram: @ivan.p"

### Комментарий к заказу:
- `comment` - Любое пожелание или уточнение к заказу (опционально, до произвольной длины)

### DeliveryType (выбор типа доставки):
- `CDEK_PICKUP` - Самовывоз из ПВЗ CDEK (500₽) - только для России и Беларуси
- `STANDARD` - Почтовая доставка (800₽) - для всех остальных стран

⚠️ **Важно:** Используйте endpoint `/api/orders/delivery-options?country=RU` для получения доступных типов доставки в зависимости от страны.

### PaymentMethod (метод оплаты):
- `CARD_ONLINE` - Яндекс Пей (фейковая оплата, автоматически успешная)

⚠️ **Важно:** Только Яндекс Пей доступен для всех стран. Оплата проходит автоматически.

### Response:
```json
{
  "id": "uuid",
  "orderNumber": "SALIY2603290001",
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "socialContact": "Telegram: @ivan_petrov",
  "comment": "Пожалуйста, упакуйте в подарочную упаковку",
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE",
  "originalSubtotal": 9500,
  "subtotal": 8550,
  "deliveryTotal": 800,
  "discountAmount": 855,
  "total": 8495,
  "status": "CONFIRMED",
  "isPaid": true,
  "currency": "RUB",
  "promoCode": { "code": "SALE10" },
  "items": [
    {
      "productId": 20,
      "name": "Джинсовка SALIY чёрная",
      "size": "M",
      "color": "black",
      "quantity": 1,
      "price": 9500,
      "discount": 10,
      "finalPrice": 8550,
      "totalPrice": 8550,
      "imageUrl": {
        "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
        "isPreview": true,
        "previewOrder": 1
      }
    }
  ]
}
```

> **Примечание:** `promoCode` при создании возвращает только `{ code }`. Для полных данных промокода (type, value) используйте `GET /api/orders/:orderNumber`.

---

## 4. Получить заказ по номеру

**GET** `/api/orders/:orderNumber`

Возвращает детальную информацию о заказе по его номеру.

```bash
curl https://saliy-shop.ru/api/orders/SALIY2603290001
```

### Response:
```json
{
  "id": "uuid",
  "orderNumber": "SALIY2603290001",
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "socialContact": "Telegram: @ivan_test",
  "comment": "Пожалуйста, упакуйте в подарочную упаковку",
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE",
  "originalSubtotal": 9500,
  "subtotal": 8550,
  "deliveryTotal": 800,
  "discountAmount": 855,
  "total": 8495,
  "status": "CONFIRMED",
  "isPaid": true,
  "currency": "RUB",
  "createdAt": "2026-03-29T12:00:00.000Z",
  "items": [
    {
      "id": "item-uuid",
      "productId": 20,
      "name": "Джинсовка SALIY чёрная",
      "slug": "dzhinsovka-saliy-black",
      "color": "black",
      "size": "M",
      "quantity": 1,
      "price": 9500,
      "discount": 10,
      "finalPrice": 8550,
      "totalPrice": 8550,
      "imageUrl": {
        "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
        "isPreview": true,
        "previewOrder": 1
      }
    }
  ],
  "promoCode": {
    "code": "SALE10",
    "type": "PERCENTAGE",
    "value": 10
  }
}
```

### Поля товаров (items):
- **name** - название товара (снэпшот на момент заказа)
- **slug** - слаг для ссылки на страницу товара
- **imageUrl** - первое изображение товара
- **size** - размер заказанного товара
- **color** - цвет товара
- **quantity** - количество
- **price** - оригинальная цена за единицу
- **discount** - скидка товара в процентах
- **finalPrice** - финальная цена за единицу (с учетом скидки товара)
- **totalPrice** - общая стоимость позиции (finalPrice × quantity)

### Комментарий:
- **comment** - комментарий к заказу (null если не указан)

### Промокод:
- **promoCode** - информация о примененном промокоде (null если не использовался)
  - `code` - код промокода
  - `type` - тип (PERCENTAGE, FIXED, FREE_DELIVERY)
  - `value` - значение скидки

---

## 5. Получить мои заказы

**GET** `/api/orders`

**Требуется авторизация:** Да

Возвращает список всех заказов текущего пользователя (отсортированы по дате создания, новые первые).

```bash
curl https://saliy-shop.ru/api/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Response:
```json
[
  {
    "id": "uuid",
    "orderNumber": "SALIY2603300003",
    "firstName": "Иван",
    "lastName": "Петров",
    "email": "test@example.com",
    "phone": "+375291234567",
    "socialContact": "Telegram: @ivan_test",
    "comment": null,
    "deliveryType": "STANDARD",
    "paymentMethod": "CARD_ONLINE",
    "originalSubtotal": 21000,
    "subtotal": 19000,
    "deliveryTotal": 800,
    "discountAmount": 1900,
    "total": 17900,
    "status": "CONFIRMED",
    "isPaid": true,
    "currency": "RUB",
    "createdAt": "2026-03-30T10:30:00.000Z",
    "items": [
      {
        "id": "item-uuid-1",
        "productId": 20,
        "name": "Джинсовка SALIY чёрная",
        "slug": "dzhinsovka-saliy-black",
        "color": "black",
        "size": "M",
        "quantity": 2,
        "price": 9500,
        "discount": 0,
        "finalPrice": 9500,
        "totalPrice": 19000,
        "imageUrl": {
          "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
          "isPreview": true,
          "previewOrder": 1
        }
      }
    ],
    "promoCode": {
      "code": "SALE10",
      "type": "PERCENTAGE",
      "value": 10
    }
  },
  {
    "id": "uuid-2",
    "orderNumber": "SALIY2603290001",
    "...": "..."
  }
]
```

### Что возвращается:
- ✅ Полная информация о каждом заказе
- ✅ Все товары с фотографиями, slug, размерами, `finalPrice`, `totalPrice`
- ✅ `originalSubtotal` — сумма до всех скидок
- ✅ Информация о промокоде (code, type, value) если был использован
- ✅ Детали доставки и оплаты
- ✅ Отсортировано по дате (новые первые)

---

## Flow оформления заказа

1. **Пользователь заполняет форму** с данными:
   - ФИО, email, телефон
   - Контакт в соц. сети (опционально): Telegram/Instagram
   - Адрес доставки
   - Тип доставки и оплаты

2. **Вызывается POST /api/orders/calculate**
   - Показывается итоговая сумма
   - Проверяется наличие товаров
   - Рассчитывается доставка

3. **Пользователь нажимает "Оплатить"**

4. **Вызывается POST /api/orders**
   - Создается заказ
   - Уменьшаются остатки
   - Отправляется email уведомление

---

## Профиль пользователя

Данные из профиля автоматически подставляются в форму заказа:
- `firstName`, `lastName`, `phone`
- `socialContact` - контакт в соц. сети
- Адрес доставки

---

## 6. Валидация промокода

**POST** `/api/promo/validate`

Проверяет промокод перед применением в заказе (опционально).

### Request:
```json
{
  "code": "SALE10",
  "orderAmount": 9500,
  "cartItems": [
    {
      "productId": 20,
      "quantity": 1,
      "price": 9500
    }
  ]
}
```

### Response (валидный промокод):
```json
{
  "isValid": true,
  "discount": 950,
  "message": "Скидка 10%",
  "promoCode": {
    "id": 1,
    "code": "SALE10",
    "type": "PERCENTAGE",
    "value": 10
  }
}
```

### Response (невалидный промокод):
```json
{
  "isValid": false,
  "discount": 0,
  "message": "Промокод не найден"
}
```

### Возможные причины невалидности:
- Промокод не найден
- Промокод не активен
- Срок действия истек
- Достигнут лимит использований
- Промокод недоступен для вашего аккаунта
- Минимальная сумма заказа не достигнута
- Промокоды не применяются к новинкам в корзине

---

## Работа с промокодами

### Применение промокода:
1. **Опционально:** Проверить промокод через `POST /api/promo/validate`
2. Добавить поле `promoCode` в запрос создания/расчета заказа
3. Если промокод невалиден - получите ошибку 400 с описанием причины

### Пример с промокодом:
```json
{
  "items": [{"productId": 20, "size": "M", "quantity": 1}],
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE",
  "promoCode": "SALE10"
}
```

### Ограничения:
- ❌ Промокоды не применяются к товарам с меткой "NEW" (кроме FREE_DELIVERY)
- ✅ Скидка рассчитывается на сервере (цены не от клиента!)
- ✅ Автоматически записывается история использования
- ✅ Работает для гостей и авторизованных пользователей
