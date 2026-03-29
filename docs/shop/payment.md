# API оплаты (Yandex Pay)

## Интеграция Yandex Pay

### Настройка

1. Получить API ключи в [личном кабинете Yandex Pay](https://pay.yandex.ru)
2. Настроить переменные окружения:
```env
YANDEX_PAY_SANDBOX=true  # true для тестирования
YANDEX_PAY_SANDBOX_API_KEY=ваш_тестовый_ключ
YANDEX_PAY_API_KEY=ваш_продакшн_ключ
```

3. Настроить Callback URL для webhook: `https://saliy-shop.ru/api/payment/webhook/yandex`

---

## Тестовые данные (Sandbox)

### API Endpoints
- **Sandbox Base URL**: `https://sandbox.pay.yandex.ru/api/merchant`
- **Payment URL**: Содержат `sandbox` (e.g., `https://sandbox.pay.ya.ru/o/nxPUqR`)

### Тестовые карты

| Тип карты | Сумма | Результат |
|-----------|-------|-----------|
| МИР | Любая (кроме специальных) | Успешная оплата (CAPTURED) |
| МИР | 10,001₽ | Ошибка оплаты (FAILED) |
| МИР | 10,002₽ | Недостаточно средств |
| МИР | 10,004₽ | Вечный PENDING (для тестов polling) |
| VISA | Любая | "Карта не подходит" |

---

## Flow оформления заказа

### 1. Клиент создает заказ

**POST** `/api/orders`

```json
{
  "items": [
    {"productId": 20, "size": "M", "quantity": 2}
  ],
  "firstName": "Иван",
  "lastName": "Иванов",
  "phone": "+375291234567",
  "email": "ivan@example.com",
  "deliveryType": "POST",
  "paymentMethod": "CARD"
}
```

**Ответ:**
```json
{
  "id": "uuid",
  "orderNumber": "260330-0001",
  "total": 19000,
  "status": "PENDING",
  "isPaid": false,
  "items": [...]
}
```

### 2. Email уведомление отправлено

Клиент получает email с:
- ✅ Номером заказа
- ✅ Составом заказа
- ✅ Итоговой суммой
- ⏳ Ссылкой на оплату (скоро будет добавлена)

### 3. Клиент оплачивает

Будет создан платеж в Yandex Pay, и клиент получит URL для оплаты.

### 4. Webhook обновляет статус

Yandex Pay отправляет webhook на `/api/payment/webhook/yandex`:

```json
{
  "event": "ORDER_STATUS_UPDATED",
  "object": {
    "id": "260330-0001",
    "status": "CAPTURED"
  }
}
```

### 5. Email подтверждение

После успешной оплаты клиент получает email:
- ✅ Подтверждение оплаты
- ✅ Информация о доставке

---

## Эндпоинты

### 1. Webhook от Yandex Pay

**POST** `/api/payment/webhook/yandex`

**Headers:**
```
Content-Type: application/json
X-Yandex-Pay-Signature: <signature>
```

**Body:**
```json
{
  "event": "ORDER_STATUS_UPDATED",
  "object": {
    "id": "260330-0001",
    "status": "CAPTURED",
    "amount": {
      "value": "19000.00",
      "currency": "RUB"
    }
  }
}
```

**События:**
- `ORDER_STATUS_UPDATED` - изменение статуса заказа
- `OPERATION_STATUS_UPDATED` - изменение статуса возврата

**Статусы заказа:**
- `PENDING` - ожидает оплаты
- `CAPTURED` - оплачен
- `FAILED` - ошибка оплаты
- `CANCELED` - отменен

---

### 2. Проверить статус платежа вручную

**POST** `/api/payment/check-status`

**Body:**
```json
{
  "orderId": "260330-0001"
}
```

**Ответ:**
```json
{
  "orderId": "260330-0001",
  "status": "CAPTURED"
}
```

---

## Email уведомления

### 1. Подтверждение заказа

**Когда:** Сразу после создания заказа

**Содержание:**
- Номер заказа
- Состав заказа (таблица)
- Сумма товаров
- Стоимость доставки
- Итоговая сумма
- Кнопка "Оплатить заказ" (если есть paymentUrl)

### 2. Подтверждение оплаты

**Когда:** После успешной оплаты (status = CAPTURED)

**Содержание:**
- Номер заказа
- Подтверждение получения оплаты
- Информация о подготовке к отправке

---

## Безопасность

### Проверка подписи webhook

Yandex Pay подписывает каждый webhook. Проверка подписи:

```typescript
verifyWebhookSignature(body: string, signature: string): boolean {
  // TODO: Реализовать проверку подписи
  // См. документацию Yandex Pay
}
```

### Защита от повторной обработки

- Проверяем статус заказа перед обновлением
- Транзакция БД для атомарного обновления
- Логирование всех webhook событий

---

## Примеры использования

### Создать заказ и получить email

```bash
curl -X POST https://saliy-shop.ru/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 20, "size": "M", "quantity": 1}],
    "firstName": "Иван",
    "lastName": "Иванов",
    "email": "ivan@example.com",
    "phone": "+375291234567",
    "deliveryType": "POST",
    "paymentMethod": "CARD"
  }'
```

**Результат:**
1. ✅ Заказ создан в БД
2. ✅ Остатки уменьшены
3. ✅ Email отправлен на ivan@example.com

### Проверить статус платежа

```bash
curl -X POST https://saliy-shop.ru/api/payment/check-status \
  -H "Content-Type: application/json" \
  -d '{"orderId": "260330-0001"}'
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные / Недостаточно товара |
| 401 | Требуется авторизация |
| 404 | Заказ не найден |
| 500 | Ошибка сервера / Ошибка оплаты |

---

## TODO

- [ ] Реализовать проверку подписи webhook Yandex Pay
- [ ] Добавить создание платежа при создании заказа
- [ ] Добавить paymentUrl в ответ API
- [ ] Реализовать возвраты (refunds)
- [ ] Добавить промокоды
