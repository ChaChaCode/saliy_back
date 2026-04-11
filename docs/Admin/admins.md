# API админ-панели: Управление администраторами

**Базовый URL:** `/api/admin/admins`

**Требуется авторизация:** Admin Bearer Token

---

## Роли

| Роль | Назначение |
|------|-----------|
| `SUPER_ADMIN` | Полный доступ ко всему |
| `ADMIN` | Управление заказами, товарами, пользователями |
| `MODERATOR` | Только просмотр |

---

## 1. Список админов

**GET** `/api/admin/admins`

### Response:
```json
[
  {
    "id": "uuid",
    "telegramId": "123456789",
    "name": "Иван Админов",
    "role": "SUPER_ADMIN",
    "isActive": true,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-04-11T12:00:00.000Z"
  }
]
```

---

## 2. Получить админа по ID

**GET** `/api/admin/admins/:id`

---

## 3. Создать админа

**POST** `/api/admin/admins`

### Request:
```json
{
  "telegramId": "987654321",
  "name": "Новый Админ",
  "role": "ADMIN"
}
```

### Ошибки:
- `400` — админ с таким Telegram ID уже существует

---

## 4. Обновить админа

**PATCH** `/api/admin/admins/:id`

### Request (любые поля опциональны):
```json
{
  "name": "Новое имя",
  "role": "MODERATOR",
  "isActive": false
}
```

Деактивация (`isActive: false`) — альтернатива удалению. Такой админ не сможет войти, но сохранится в БД.

---

## 5. Удалить админа

**DELETE** `/api/admin/admins/:id`

### Ограничения:
- ❌ Нельзя удалить **самого себя**
- Лучше использовать деактивацию через `PATCH`

### Response:
```json
{ "success": true }
```
