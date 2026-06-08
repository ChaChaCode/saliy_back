# API админ-панели: Audit Log

**Базовый URL:** `/api/admin/audit`

**Авторизация:** все эндпоинты требуют авторизации администратора (`AdminGuard`). Запросы авторизуются через httpOnly cookie `adminToken`, которую браузер отправляет автоматически (заголовок `Authorization` также принимается для обратной совместимости).

---

## Как это работает

Все state-changing запросы (`POST`, `PUT`, `PATCH`, `DELETE`) на маршруты `/admin/*` автоматически пишутся в таблицу `audit_logs`. Ничего вручную вызывать не нужно — интерцептор подключён глобально через `APP_INTERCEPTOR` в `src/admin/audit/audit.module.ts`.

Что логируется:
- **Кто** — `adminId` + `adminName` (из `req.admin`)
- **Что** — метод + путь + action (CREATE / UPDATE / DELETE)
- **Изменения** — тело запроса (пароли/токены маскируются как `***`)
- **Откуда** — IP + User-Agent
- **Результат** — HTTP status code

Что НЕ логируется:
- GET-запросы (чтобы не засорять БД)
- `/admin/auth/*` (иначе логировались бы все попытки входа)
- `/admin/webhook/*` (Telegram webhook'и)

---

## Получить записи аудита

**GET** `/api/admin/audit`

| Параметр | Описание |
|----------|----------|
| `adminId` | Фильтр по админу |
| `entityType` | Фильтр по типу сущности (`orders`, `products`, `users`, ...) |
| `action` | `CREATE` / `UPDATE` / `DELETE` |
| `dateFrom`, `dateTo` | Период |
| `page`, `limit` | Пагинация (default 1 / 50) |

Ответ: объект с полями `logs` (массив) и `pagination`. Каждая запись содержит: `id`, `adminId`, `adminName`, `action`, `method`, `path`, `entityType`, `entityId`, `changes`, `ip`, `userAgent`, `statusCode`, `createdAt`.

---

## Таблица entity_type ↔ маршрут

Интерцептор извлекает `entityType` как первый сегмент после `/admin/`:

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

Интерцептор не блокирует основной запрос — даже если запись в аудит упадёт, ответ клиенту придёт нормально (ошибка уходит только в лог).

Чувствительные поля (`password`, `token`, `secret`, `apiKey`, `refreshToken`) автоматически маскируются в `changes`.
