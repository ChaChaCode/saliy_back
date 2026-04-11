# API админ-панели: Модерация отзывов

**Базовый URL:** `/api/admin/reviews`

**Требуется авторизация:** Admin Bearer Token

Все отзывы создаются в статусе `PENDING` и видны только в админке. Публикация на сайте — только после `approve`.

---

## Статусы отзывов

| Статус | Видимость |
|--------|-----------|
| `PENDING` | Только в админке |
| `APPROVED` | На сайте + в админке |
| `REJECTED` | Только в админке |

---

## 1. Статистика отзывов

**GET** `/api/admin/reviews/stats`

### Response:
```json
{
  "pending": 5,
  "approved": 120,
  "rejected": 8,
  "total": 133
}
```

Используйте `pending` как бейдж в навигации админки ("требуют модерации").

---

## 2. Список отзывов

**GET** `/api/admin/reviews`

### Query параметры:
| Параметр | Описание |
|----------|----------|
| `status` | `PENDING` / `APPROVED` / `REJECTED` |
| `productId` | Фильтр по товару |
| `page`, `limit` | Пагинация (default 1 / 20) |

### Response:
```json
{
  "reviews": [
    {
      "id": "review-uuid",
      "productId": 20,
      "userId": "user-uuid",
      "authorName": "Иван П.",
      "rating": 5,
      "text": "Отличное качество!",
      "status": "PENDING",
      "moderatedAt": null,
      "moderatedBy": null,
      "createdAt": "2026-04-11T12:00:00.000Z",
      "product": {
        "id": 20,
        "name": "Джинсовка SALIY чёрная",
        "slug": "dzhinsovka-saliy-black"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

---

## 3. Одобрить отзыв

**POST** `/api/admin/reviews/:id/approve`

Переводит отзыв в `APPROVED` — он сразу появляется на сайте. Записывает `moderatedAt` и `moderatedBy` (ID текущего админа).

### Response:
Обновлённый объект отзыва.

---

## 4. Отклонить отзыв

**POST** `/api/admin/reviews/:id/reject`

Переводит отзыв в `REJECTED` — он не виден на сайте, но сохраняется для истории.

---

## 5. Удалить отзыв

**DELETE** `/api/admin/reviews/:id`

Физическое удаление из БД.

### Response:
```json
{ "success": true }
```
