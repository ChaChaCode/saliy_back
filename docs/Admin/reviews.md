# API админ-панели: Управление отзывами

**Базовый URL:** `/api/admin/reviews`

**Требуется авторизация:** Admin Bearer Token (`AdminGuard`)

Админ видит все отзывы (включая `PENDING` и `REJECTED`), может редактировать, удалять, добавлять свои, управлять фотографиями.

---

## Содержание

- [Статусы отзывов](#статусы-отзывов)
- [Эндпоинты](#эндпоинты)
  - [GET /api/admin/reviews/stats](#1-статистика-отзывов) — счётчики pending/approved/rejected
  - [GET /api/admin/reviews](#2-список-отзывов-с-фильтрами) — список с фильтрами и пагинацией
  - [GET /api/admin/reviews/:id](#3-получить-один-отзыв) — детали (автор + товар + фото)
  - [POST /api/admin/reviews](#4-создать-отзыв-от-имени-админа) — создать (bypass DELIVERED)
  - [PATCH /api/admin/reviews/:id](#5-отредактировать-отзыв) — text/rating/authorName/status
  - [POST /api/admin/reviews/:id/images](#6-добавить-фото-к-отзыву) — добавить фото
  - [PATCH /api/admin/reviews/:id/delete-image](#7-удалить-одно-фото-из-отзыва) — удалить одно фото
  - [POST /api/admin/reviews/:id/approve](#8-одобрить-отзыв) — одобрить
  - [POST /api/admin/reviews/:id/reject](#9-отклонить-отзыв) — отклонить
  - [DELETE /api/admin/reviews/:id](#10-удалить-отзыв) — физическое удаление

---

## Статусы отзывов

| Статус | Видимость на сайте | Доступен в админке |
|--------|-----|-----|
| `PENDING` | ❌ | ✅ |
| `APPROVED` | ✅ | ✅ |
| `REJECTED` | ❌ | ✅ |

---

## Лимиты

- **Текст:** до 1000 символов
- **Фото:** до 5 штук на отзыв (JPG/PNG/WEBP, 5MB на файл)

---

## Эндпоинты

### 1. Статистика отзывов

**GET** `/api/admin/reviews/stats`

```json
{
  "pending": 5,
  "approved": 120,
  "rejected": 8,
  "total": 133
}
```

Используй `pending` как бейдж в навигации админки.

---

### 2. Список отзывов с фильтрами

**GET** `/api/admin/reviews`

#### Query параметры:
| Параметр | Тип | Описание |
|---|---|---|
| `status` | `PENDING \| APPROVED \| REJECTED` | Фильтр по статусу |
| `productId` | `number` | Фильтр по товару |
| `userId` | `string` (UUID) | Фильтр по автору (если отзыв привязан к юзеру) |
| `search` | `string` | Поиск по `authorName` и `text` (case-insensitive) |
| `page` | `number` | По умолчанию 1 |
| `limit` | `number` | По умолчанию 20 |

#### Response:
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
      "images": [
        "https://storage.yandexcloud.net/saliy-shop/reviews/20/user-uuid-1714000000-0.jpg"
      ],
      "status": "PENDING",
      "moderatedAt": null,
      "moderatedBy": null,
      "createdAt": "2026-04-11T12:00:00.000Z",
      "updatedAt": "2026-04-11T12:00:00.000Z",
      "product": {
        "id": 20,
        "name": "Джинсовка SALIY чёрная",
        "slug": "dzhinsovka-saliy-black"
      },
      "user": {
        "id": "user-uuid",
        "email": "ivan@example.com",
        "name": "Иван Петров",
        "firstName": "Иван",
        "lastName": "Петров"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

> `user` — `null`, если отзыв был создан гостем / админом без привязки к юзеру.

---

### 3. Получить один отзыв

**GET** `/api/admin/reviews/:id`

Ответ — тот же enriched-объект, что и элемент массива в `findAll` (с `product` и `user`).

---

### 4. Создать отзыв от имени админа

**POST** `/api/admin/reviews`

**Content-Type:** `multipart/form-data`

Обходит проверку DELIVERED-заказа (в отличие от публичного `POST /api/reviews`). Полезно для наполнения новых товаров или внесения отзывов от оффлайн-клиентов.

#### Поля формы:
| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `productId` | number | ✅ | ID товара |
| `authorName` | string | ✅ | Имя автора, до 100 символов |
| `rating` | number (1-5) | ✅ | Оценка |
| `text` | string | ❌ | Текст, до 1000 символов |
| `status` | `PENDING \| APPROVED \| REJECTED` | ❌ | По умолчанию `PENDING`. При `APPROVED` — сразу виден на сайте |
| `userId` | string (UUID) | ❌ | Если нужно привязать отзыв к существующему юзеру |
| `images` | file[] | ❌ | До 5 фото (jpg/png/webp, 5MB/файл) |

#### Пример (curl):
```bash
curl -X POST https://saliy-shop.ru/api/admin/reviews \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "productId=20" \
  -F "authorName=Анна К." \
  -F "rating=5" \
  -F "text=Шикарное качество, ношу уже полгода." \
  -F "status=APPROVED" \
  -F "images=@photo1.jpg"
```

#### Response:
Тот же enriched-объект (как в `GET /:id`).

---

### 5. Отредактировать отзыв

**PATCH** `/api/admin/reviews/:id`

**Content-Type:** `application/json`

#### Тело (все поля опциональны):
```json
{
  "authorName": "Анна Константинова",
  "rating": 4,
  "text": "Обновлённый текст отзыва...",
  "status": "APPROVED"
}
```

- Если меняется `status` — автоматически обновляются `moderatedAt` / `moderatedBy`.
- Картинки редактируются отдельными эндпоинтами — см. ниже.
- Передать `text: null` — очистить текст.

---

### 6. Добавить фото к отзыву

**POST** `/api/admin/reviews/:id/images`

**Content-Type:** `multipart/form-data`

Добавить одну или несколько фоток к существующему отзыву. Суммарно у отзыва не должно быть больше 5 фото, иначе `400`.

```bash
curl -X POST https://saliy-shop.ru/api/admin/reviews/$REVIEW_ID/images \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "images=@new-photo.jpg"
```

---

### 7. Удалить одно фото из отзыва

**PATCH** `/api/admin/reviews/:id/delete-image`

**Content-Type:** `application/json`

```json
{
  "imageUrl": "https://storage.yandexcloud.net/saliy-shop/reviews/20/user-uuid-1714000000-0.jpg"
}
```

> `imageUrl` принимает полный URL (как клиент видит) ИЛИ S3-ключ (`reviews/20/foo.jpg`). Бэк нормализует перед поиском.

Файл удаляется из S3, URL убирается из массива `images` в БД.

---

### 8. Одобрить отзыв

**POST** `/api/admin/reviews/:id/approve`

Переводит в `APPROVED`, пишет `moderatedAt` + `moderatedBy`.

---

### 9. Отклонить отзыв

**POST** `/api/admin/reviews/:id/reject`

Переводит в `REJECTED`. Не виден на сайте, но сохраняется для истории.

---

### 10. Удалить отзыв

**DELETE** `/api/admin/reviews/:id`

Физическое удаление из БД + удаление всех связанных фото из S3.

```json
{ "success": true }
```

---

## Типичный UX админки

1. Открыть список с `status=PENDING` — показать новые отзывы для модерации.
2. Клик по отзыву → `GET /:id` → карточка с автором, товаром, фото.
3. Кнопки: «Одобрить», «Отклонить», «Удалить», «Редактировать».
4. Поиск по `search=...` + фильтр `productId=...` + `userId=...` — найти конкретный отзыв.
5. «Добавить отзыв» вручную — форма, после отправки → `POST /admin/reviews` с `status=APPROVED`.
