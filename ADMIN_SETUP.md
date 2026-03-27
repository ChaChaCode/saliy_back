# Настройка админской авторизации через Telegram

## 1. Создать первого администратора

Открой Prisma Studio (уже запущен в фоне):
```
http://localhost:5555
```

Перейди в таблицу `admins` и создай запись:
```
id: admin-1
name: Main Admin
role: SUPER_ADMIN
isActive: true
```

Или через SQL:
```sql
INSERT INTO admins (id, name, role, is_active, created_at, updated_at)
VALUES ('admin-1', 'Main Admin', 'SUPER_ADMIN', true, NOW(), NOW());
```

## 2. Настроить Telegram webhook

После деплоя на production запусти:

```bash
./setup_telegram_webhook.sh
```

Или вручную:
```bash
curl -X POST "https://api.telegram.org/bot8488379985:AAGobKg7euDd21V22-k_r0F31eCHGjv2lrY/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://saliy-shop.ru/api/admin/telegram/webhook"}'
```

Проверить статус:
```bash
curl "https://api.telegram.org/bot8488379985:AAGobKg7euDd21V22-k_r0F31eCHGjv2lrY/getWebhookInfo"
```

## 3. Тестирование авторизации

### Шаг 1: Запросить вход
```bash
curl -X POST https://saliy-shop.ru/api/admin/auth/request-login
```

Ответ:
```json
{
  "loginId": "uuid-here",
  "expiresIn": 300,
  "verificationCode": "X7K9"
}
```

### Шаг 2: Проверить Telegram канал
В канал `-1003644248789` придёт сообщение:
```
🔐 Запрос входа в админку

🔑 Код: X7K9

📍 IP: ...
🌍 Локация: ...
🌐 Браузер: ...

[✅ Подтвердить] [❌ Блок IP]
```

### Шаг 3: Polling статуса (фронтенд делает каждые 2 сек)
```bash
curl https://saliy-shop.ru/api/admin/auth/check-status/LOGIN_ID
```

До подтверждения:
```json
{
  "approved": false
}
```

После нажатия кнопки "Подтвердить":
```json
{
  "approved": true,
  "token": "eyJhbGci..."
}
```

### Шаг 4: Использовать токен
```bash
curl -H "Authorization: Bearer TOKEN" \
  -X POST https://saliy-shop.ru/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовый товар",
    "slug": "test-product",
    "price": 5000,
    "discount": 0
  }'
```

## 4. Обновление токена

Токен живёт 24 часа. Для обновления:
```bash
curl -X POST https://saliy-shop.ru/api/admin/auth/refresh \
  -H "Authorization: Bearer OLD_TOKEN"
```

Ответ:
```json
{
  "token": "new_token...",
  "expiresIn": 86400
}
```

## 5. Безопасность

### Rate Limiting
- Запрос входа: **5 запросов в 10 минут** с одного IP
- Остальные эндпоинты: **100 запросов в минуту** с одного IP

### Брутфорс защита
- После **10 неудачных попыток** авторизации IP блокируется на **15 минут**
- В Telegram приходит уведомление с кнопками:
  - **🔓 Разблокировать** - снять блокировку
  - **🚫 Заблокировать навсегда** - заблокировать IP навсегда

### Кнопки в Telegram

После подтверждения входа:
```
[✅ Выполнено] [🔓 Отозвать]
```
- **Отозвать** - отозвать токен (пользователь будет разлогинен)

После блокировки IP:
```
[🚫 Заблокирован] [🔓 Разблокировать]
```

## 6. Логи

Все действия логируются:
- Создание/обновление/удаление товаров
- Попытки авторизации
- Блокировки IP

Смотреть логи:
```bash
pm2 logs saliy-api
# или
tail -f logs/app.log
```

## 7. Защищённые эндпоинты

Требуют `Authorization: Bearer TOKEN`:

### Товары
- `POST /api/products` - создание
- `PUT /api/products/:id` - обновление
- `DELETE /api/products/:id` - удаление

### Будущие админские функции
- Управление заказами
- Управление пользователями
- Статистика

## Troubleshooting

### Webhook не работает
```bash
# Проверить статус
curl "https://api.telegram.org/bot8488379985:AAGobKg7euDd21V22-k_r0F31eCHGjv2lrY/getWebhookInfo"

# Удалить webhook
curl "https://api.telegram.org/bot8488379985:AAGobKg7euDd21V22-k_r0F31eCHGjv2lrY/deleteWebhook"

# Установить заново
./setup_telegram_webhook.sh
```

### Токен не работает
Проверить:
1. Токен не истёк (24 часа)
2. Токен не отозван
3. Админ активен в БД
4. Правильный формат: `Authorization: Bearer TOKEN`

### IP заблокирован
В Telegram нажать кнопку "🔓 Разблокировать" или очистить кеш:
```bash
# Если есть доступ к серверу
pm2 restart saliy-api
```
