# API админ-панели: Audit Log

**Базовый URL:** `/api/admin/audit`

**Требуется авторизация:** Admin Bearer Token

---

## Как это работает

Все state-changing запросы (`POST`, `PUT`, `PATCH`, `DELETE`) на маршруты `/admin/*` **автоматически** пишутся в таблицу `audit_logs`. Ничего вручную вызывать не нужно — интерцептор подключён глобально через `APP_INTERCEPTOR` в [src/admin/audit/audit.module.ts](src/admin/audit/audit.module.ts).

### Что логируется:
- **Кто** — `adminId` + `adminName` (из `req.admin`)
- **Что** — метод + путь + action (CREATE / UPDATE / DELETE)
- **Изменения** — тело запроса (пароли/токены маскируются как `***`)
- **Откуда** — IP + User-Agent
- **Результат** — HTTP status code

### Что НЕ логируется:
- GET-запросы (чтобы не засорять БД)
- `/admin/auth/*` (иначе логировались бы все попытки входа)
- `/admin/webhook/*` (Telegram webhook'и)

---

## GET /api/admin/audit

### Query параметры:
| Параметр | Описание |
|----------|----------|
| `adminId` | Фильтр по админу |
| `entityType` | Фильтр по типу сущности (`orders`, `products`, `users`, ...) |
| `action` | `CREATE` / `UPDATE` / `DELETE` |
| `dateFrom`, `dateTo` | Период |
| `page`, `limit` | Пагинация (default 1 / 50) |

### Пример:
```bash
curl "https://saliy-shop.ru/api/admin/audit?entityType=orders&action=UPDATE&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response:
```json
{
  "logs": [
    {
      "id": "uuid",
      "adminId": "admin-uuid",
      "adminName": "Иван Админов",
      "action": "UPDATE",
      "method": "PATCH",
      "path": "/api/admin/orders/SALIY2603290001/status",
      "entityType": "orders",
      "entityId": "SALIY2603290001",
      "changes": { "status": "SHIPPED" },
      "ip": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "statusCode": 200,
      "createdAt": "2026-04-11T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 342, "totalPages": 7 }
}
```

---

## Таблица `entity_type` ↔ маршрут

Интерцептор автоматически извлекает `entity_type` как первый сегмент после `/admin/`:

| Путь | entityType |
|------|-----------|
| `/api/admin/orders/...` | `orders` |
| `/api/admin/products/...` | `products` |
| `/api/admin/users/...` | `users` |
| `/api/admin/reviews/...` | `reviews` |
| `/api/admin/campaigns/...` | `campaigns` |
| `/api/admin/settings/...` | `settings` |
| `/api/admin/admins/...` | `admins` |

---

## Безопасность

Интерцептор **не блокирует** основной запрос — даже если запись в аудит упадёт, ответ клиенту придёт нормально (ошибка уходит только в лог).

Чувствительные поля (`password`, `token`, `secret`, `apiKey`, `refreshToken`) автоматически маскируются в `changes`.
