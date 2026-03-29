# API заказов

## 1. Рассчитать стоимость заказа

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
      "discount": 0,
      "finalPrice": 9500,
      "totalPrice": 9500,
      "imageUrl": {
        "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
        "isPreview": true,
        "previewOrder": 1
      }
    }
  ],
  "subtotal": 9500,
  "discountAmount": 0,
  "deliveryPrice": 0,
  "total": 9500,
  "currency": "RUB"
}
```

---

## 2. Создать заказ

**POST** `/api/orders`

Создает заказ и сразу подтверждает оплату.
Отправляется email с подтверждением заказа.

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
  "paymentMethod": "CARD_ONLINE"
}
```

### Новое поле для связи:
- `socialContact` - Контакт в соц. сети (опционально)
  - Примеры: "Telegram: @ivan_petrov" или "Instagram: @ivan.p"

### DeliveryType (выбор типа доставки):
- `CDEK_PICKUP` - Самовывоз из ПВЗ CDEK
- `CDEK_COURIER` - Курьерская доставка CDEK
- `STANDARD` - Стандартная доставка

### PaymentMethod (метод оплаты):
- `CARD_ONLINE` - Онлайн оплата картой
- `CARD_MANUAL` - Оплата картой через менеджера
- `CRYPTO` - Криптовалюта
- `PAYPAL` - PayPal

### Response:
```json
{
  "id": "uuid",
  "orderNumber": "260329-0001",
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "socialContact": "Telegram: @ivan_petrov",
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE",
  "subtotal": 9500,
  "deliveryTotal": 0,
  "discountAmount": 0,
  "total": 9500,
  "status": "CONFIRMED",
  "isPaid": true,
  "currency": "RUB",
  "items": [...]
}
```

---

## 3. Получить заказ по номеру

**GET** `/api/orders/:orderNumber`

```bash
curl https://saliy-shop.ru/api/orders/260329-0001
```

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

## 4. Валидация промокода

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
