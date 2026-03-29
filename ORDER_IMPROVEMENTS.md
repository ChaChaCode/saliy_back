# Улучшения системы заказов

## ✅ Что сделано

### 1. Добавлены поля для связи с клиентом

**В User (профиль):**
- `username` - Имя пользователя
- `telegram` - Telegram username (@username)
- `instagram` - Instagram username (@username)

**В Order (заказ):**
- `username`, `telegram`, `instagram` - снэпшот данных на момент заказа

### 2. Новый endpoint для расчета стоимости

**POST** `/api/orders/calculate`

Рассчитывает итоговую стоимость ПЕРЕД созданием заказа.

**Зачем нужен:**
- Показать пользователю итоговую сумму
- Проверить наличие товаров на складе
- Рассчитать доставку и скидки
- После этого пользователь нажимает "Оплатить"

**Что возвращает:**
```json
{
  "items": [...],          // Список товаров с ценами из БД
  "subtotal": 9500,        // Сумма товаров
  "discountAmount": 0,     // Скидка по промокоду
  "deliveryPrice": 0,      // Стоимость доставки
  "total": 9500,           // ИТОГО
  "currency": "RUB"
}
```

---

## 🔄 Flow оформления заказа

### Шаг 1: Пользователь заполняет форму
```
- ФИО, email, телефон
- Username (опционально)
- Telegram/Instagram (опционально)
- Адрес доставки
- Тип доставки и оплаты
```

### Шаг 2: Расчет стоимости
```bash
POST /api/orders/calculate
{
  "items": [{"productId": 20, "size": "M", "quantity": 1}],
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

**Ответ:**
```
Итого: 9500 RUB
```

### Шаг 3: Пользователь нажимает "Оплатить"

### Шаг 4: Создание заказа
```bash
POST /api/orders
# Те же данные что и в calculate
```

**Результат:**
- ✅ Заказ создан (status: CONFIRMED)
- ✅ Остатки уменьшены
- ✅ Email отправлен

---

## 📊 Данные заказа (расширенные)

```json
{
  "orderNumber": "260329-0001",
  "firstName": "Иван",
  "lastName": "Петров",
  "email": "test@example.com",
  "phone": "+375291234567",
  "username": "ivan_p",           // ⬅️ НОВОЕ
  "telegram": "@ivan_petrov",     // ⬅️ НОВОЕ
  "instagram": "@ivan.p",         // ⬅️ НОВОЕ
  "deliveryType": "STANDARD",
  "paymentMethod": "CARD_ONLINE",
  "subtotal": 9500,
  "deliveryTotal": 0,
  "discountAmount": 0,
  "total": 9500,
  "status": "CONFIRMED",
  "isPaid": true,
  "items": [...]
}
```

---

## 🧪 Тестирование

### 1. Расчет стоимости
```bash
curl -X POST "https://saliy-shop.ru/api/orders/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 20, "size": "M", "quantity": 1}],
    "firstName": "Иван",
    "lastName": "Петров",
    "email": "test@example.com",
    "phone": "+375291234567",
    "username": "ivan_p",
    "telegram": "@ivan_petrov",
    "instagram": "@ivan.p",
    "deliveryType": "STANDARD",
    "paymentMethod": "CARD_ONLINE"
  }'
```

### 2. Создание заказа (с новыми полями)
```bash
curl -X POST "https://saliy-shop.ru/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 20, "size": "M", "quantity": 1}],
    "firstName": "Иван",
    "lastName": "Петров",
    "email": "mezovt123@gmail.com",
    "phone": "+375291234567",
    "username": "ivan_p",
    "telegram": "@ivan_petrov",
    "instagram": "@ivan.p",
    "deliveryType": "STANDARD",
    "paymentMethod": "CARD_ONLINE"
  }'
```

---

## 📝 База данных

### Миграция выполнена:
```sql
-- В таблицу users добавлены:
ALTER TABLE users ADD COLUMN username VARCHAR;
ALTER TABLE users ADD COLUMN telegram VARCHAR;
ALTER TABLE users ADD COLUMN instagram VARCHAR;

-- В таблицу orders добавлены:
ALTER TABLE orders ADD COLUMN username VARCHAR;
ALTER TABLE orders ADD COLUMN telegram VARCHAR;
ALTER TABLE orders ADD COLUMN instagram VARCHAR;
```

---

## 📖 Документация

Обновлена документация:
- `docs/shop/orders.md` - полная документация по API заказов
