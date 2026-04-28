# API админ-панели: Подписчики рассылки

**Базовый URL:** `/api/admin/newsletter`

**Требуется авторизация:** Admin Bearer Token (`AdminGuard`)

Управление подписчиками маркетинговой рассылки. Сами подписки создаются публичным эндпоинтом [POST /api/newsletter/subscribe](../shop/newsletter.md) (форма на сайте). В админке можно смотреть кто подписан, фильтровать активных/отписавшихся и удалять записи.

---

## Содержание

- [GET /api/admin/newsletter/stats](#1-статистика-подписчиков) — счётчики
- [GET /api/admin/newsletter](#2-список-подписчиков) — список с фильтрами
- [DELETE /api/admin/newsletter/:id](#3-удалить-подписчика) — физическое удаление

---

## 1. Статистика подписчиков

**GET** `/api/admin/newsletter/stats`

```json
{
  "total": 1247,
  "active": 1183,
  "unsubscribed": 64
}
```

Используй `active` чтобы показывать «N человек подписано» в админке. `unsubscribed` — кто когда-то подписался и отписался.

---

## 2. Список подписчиков

**GET** `/api/admin/newsletter`

### Query параметры:
| Параметр | Тип | Описание |
|---|---|---|
| `isActive` | `true \| false` | Только активные / только отписавшиеся |
| `search` | `string` | Поиск по email (case-insensitive) |
| `page` | `number` | По умолчанию 1 |
| `limit` | `number` | По умолчанию 50 |

### Примеры:
```bash
# Все активные
curl "https://saliy-shop.ru/api/admin/newsletter?isActive=true" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Поиск по email
curl "https://saliy-shop.ru/api/admin/newsletter?search=ivan" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Только отписавшиеся
curl "https://saliy-shop.ru/api/admin/newsletter?isActive=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Response:
```json
{
  "subscribers": [
    {
      "id": "uuid",
      "email": "ivan@example.com",
      "isActive": true,
      "source": "footer",
      "acceptedTerms": true,
      "unsubscribeToken": "abcdef...",
      "userId": "user-uuid-or-null",
      "subscribedAt": "2026-04-29T10:00:00.000Z",
      "unsubscribedAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1247,
    "totalPages": 25
  }
}
```

### Поля
- **`source`** — откуда подписка: `footer` / `popup` / `checkout` / null. Полезно для аналитики «какая форма работает лучше».
- **`userId`** — если email совпал с зарегистрированным пользователем, тут его id. `null` — гость.
- **`unsubscribeToken`** — секретный токен. Может пригодиться чтобы вручную сгенерировать ссылку на отписку: `https://saliy-shop.ru/api/newsletter/unsubscribe/{token}`.

---

## 3. Удалить подписчика

**DELETE** `/api/admin/newsletter/:id`

Физическое удаление записи. Для «мягкой» отписки (с сохранением истории) подписчик может сам перейти по unsubscribe-ссылке из письма — тогда `isActive` станет `false`, но запись останется.

### Response
```json
{ "success": true }
```

### Когда использовать DELETE vs мягкая отписка
- **DELETE** — спам, ошибочный ввод, дубликат, запрос на удаление по GDPR
- **мягкая отписка** (через клиентскую ссылку) — обычная отписка, история сохраняется

---

## Связь с email-кампаниями

Подписчики используются в [API кампаний](./campaigns.md) как отдельная аудитория. При создании рассылки выбери `targetType: "NEWSLETTER"` — письмо уйдёт **только активным подписчикам** с автоматически добавленным unsubscribe-футером.

> **Важно:** для рассылок не подписчикам (например, всем юзерам с заказами) unsubscribe-футер **не добавляется** — это транзакционные/уведомления, не маркетинг. Если будешь использовать `targetType: "ALL"` для маркетинга — учти, что без согласия (`acceptedTerms`) это серая зона по ФЗ 152.

---

## Типичный UX в админке

1. **Дашборд** — показывать `stats.active` как один из ключевых KPI («аудитория рассылки»).
2. **Страница подписчиков** — таблица: email · источник · дата подписки · активен/отписан. Фильтры по `isActive` и `search`.
3. **Кампании** — при создании выбрать `NEWSLETTER` чтобы попасть только в подписчиков, готовых к маркетингу.
4. **Удаление** — кнопка «удалить» с подтверждением (физическое удаление по GDPR-запросам).
