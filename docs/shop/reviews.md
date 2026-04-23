# API отзывов (публичное)

**Базовый URL:** `/api/reviews`

Отзыв может оставить **только авторизованный пользователь**, у которого есть **полученный** заказ (`status = DELIVERED`), содержащий этот товар. Один отзыв на товар от одного пользователя. Все отзывы проходят модерацию — публикуются только после одобрения админом.

К отзыву можно прикрепить:
- текст до **1000 символов** (опционально)
- до **5 фотографий** (опционально, JPG/PNG/WEBP, до 5MB каждое)

---

## 1. Оставить отзыв

**POST** `/api/reviews`

**Авторизация:** обязательна (`Authorization: Bearer <access_token>`)

**Content-Type:** `multipart/form-data`

### Поля формы:

| Поле         | Тип      | Обязательно | Описание                                        |
|--------------|----------|-------------|-------------------------------------------------|
| `productId`  | number   | да          | ID товара                                       |
| `authorName` | string   | да          | Имя автора, до 100 символов                     |
| `rating`     | number   | да          | Оценка 1-5                                      |
| `text`       | string   | нет         | Текст отзыва, до 1000 символов                  |
| `images`     | file[]   | нет         | До 5 фотографий (JPG/PNG/WEBP, до 5MB каждое)   |

### Пример (curl):
```bash
curl -X POST https://saliy-shop.ru/api/reviews \
  -H "Authorization: Bearer <TOKEN>" \
  -F "productId=20" \
  -F "authorName=Иван П." \
  -F "rating=5" \
  -F "text=Отличное качество, размер подошёл идеально." \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.jpg"
```

### Пример (JS/FormData):
```js
const form = new FormData();
form.append('productId', '20');
form.append('authorName', 'Иван П.');
form.append('rating', '5');
form.append('text', 'Отличное качество');
photos.forEach((f) => form.append('images', f));

fetch('/api/reviews', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

### Response:
```json
{
  "id": "review-uuid",
  "productId": 20,
  "userId": "user-uuid",
  "authorName": "Иван П.",
  "rating": 5,
  "text": "Отличное качество...",
  "images": [
    "https://storage.yandexcloud.net/saliy-shop/reviews/20/user-uuid-1714000000000-0.jpg",
    "https://storage.yandexcloud.net/saliy-shop/reviews/20/user-uuid-1714000000001-1.jpg"
  ],
  "status": "PENDING",
  "createdAt": "2026-04-24T02:00:00.000Z",
  "updatedAt": "2026-04-24T02:00:00.000Z"
}
```

> Отзыв **не виден на сайте**, пока админ его не одобрит (`status: APPROVED`).

### Ошибки:
- `401` — нет токена / невалидный токен
- `403` — у пользователя нет полученного (`DELIVERED`) заказа с этим товаром
- `400` — рейтинг вне 1-5
- `400` — текст длиннее 1000 символов
- `400` — больше 5 фотографий
- `400` — повторный отзыв от того же пользователя на тот же товар
- `400` — неподдерживаемый формат файла (не JPG/PNG/WEBP) или размер > 5MB
- `404` — товар не найден

---

## 2. Проверить, можно ли оставить отзыв

**GET** `/api/reviews/can-review/:productId`

**Авторизация:** обязательна

Используется фронтом на странице товара, чтобы показать/скрыть форму отзыва.

### Response (если можно):
```json
{ "canReview": true }
```

### Response (если нельзя):
```json
{ "canReview": false, "reason": "NO_DELIVERED_ORDER" }
```

Возможные `reason`:
- `NOT_AUTHENTICATED` — пользователь не залогинен (можно не показывать форму)
- `NO_DELIVERED_ORDER` — нет полученного заказа с этим товаром
- `ALREADY_REVIEWED` — уже оставлял отзыв

---

## 3. Получить одобренные отзывы товара

**GET** `/api/reviews/product/:productId`

Авторизация не требуется. Возвращает **только одобренные** отзывы + средний рейтинг.

### Response:
```json
{
  "reviews": [
    {
      "id": "review-uuid",
      "authorName": "Иван П.",
      "rating": 5,
      "text": "Отличное качество...",
      "images": [
        "https://storage.yandexcloud.net/saliy-shop/reviews/20/user-uuid-1714000000000-0.jpg",
        "https://storage.yandexcloud.net/saliy-shop/reviews/20/user-uuid-1714000000001-1.jpg"
      ],
      "createdAt": "2026-04-24T02:00:00.000Z"
    }
  ],
  "averageRating": 4.7,
  "totalReviews": 42
}
```

### Поля:
- **averageRating** — средняя оценка (округлена до 0.1)
- **totalReviews** — количество одобренных отзывов
- **images** — массив полных URL (уже с S3-хостом), готов к `<img src>`.
