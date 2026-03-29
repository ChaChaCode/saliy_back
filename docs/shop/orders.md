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
  "username": "ivan_p",
  "telegram": "@ivan_petrov",
  "instagram": "@ivan.p",
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
      "productSlug": "dzhinsovka-saliy-chernaya",
      "size": "M",
      "color": "black",
      "quantity": 1,
      "price": 9500,
      "discount": 0,
      "finalPrice": 9500,
      "totalPrice": 9500,
      "imageUrl": "products/jacket.jpg"
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
Отправляются 2 email: подтверждение заказа + подтверждение оплаты.

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
  "username": "ivan_p",
  "telegram": "@ivan_petrov",
  "instagram": "@ivan.p",
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE"
}
```

### Новые поля для связи:
- `username` - Имя пользователя (опционально)
- `telegram` - Telegram username для связи (опционально)
- `instagram` - Instagram username для связи (опционально)

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
  "username": "ivan_p",
  "telegram": "@ivan_petrov",
  "instagram": "@ivan.p",
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
   - Username, Telegram, Instagram (опционально)
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
   - Отправляются email уведомления

---

## Профиль пользователя

Данные из профиля автоматически подставляются в форму заказа:
- `firstName`, `lastName`, `phone`
- `username`, `telegram`, `instagram`
- Адрес доставки
