# API корзины

## 🛒 Архитектура

### Для гостей (неавторизованных):
- **Хранение**: localStorage на клиенте
- **Формат**: `[{productId: 1, size: "M", quantity: 2}, ...]`
- **Безопасность**: Клиент хранит только ID, размер и количество. Цены берутся из БД на сервере!

### Для авторизованных пользователей:
- **Хранение**: в БД (таблица `cart_items`)
- **API**: полный CRUD для управления корзиной
- **При входе**: корзина из localStorage объединяется с корзиной в БД

---

## Эндпоинты

### 1. Получить корзину (авторизованные)

**GET** `/api/cart`

**Headers:**
```
Authorization: Bearer <token>
```

**Пример ответа:**
```json
[
  {
    "id": 1,
    "userId": "uuid-123",
    "productId": 20,
    "size": "M",
    "quantity": 2,
    "createdAt": "2026-03-30T10:00:00.000Z",
    "updatedAt": "2026-03-30T10:00:00.000Z",
    "product": {
      "id": 20,
      "name": "Джинсовка SALIY чёрная",
      "slug": "dzhinsovka-saliy-black",
      "price": 9500,
      "discount": 0,
      "images": [...]
    }
  }
]
```

---

### 2. Добавить товар в корзину (авторизованные)

**POST** `/api/cart/items`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "productId": 20,
  "size": "M",
  "quantity": 2
}
```

**Пример ответа:**
```json
{
  "id": 1,
  "userId": "uuid-123",
  "productId": 20,
  "size": "M",
  "quantity": 2,
  "createdAt": "2026-03-30T10:00:00.000Z",
  "updatedAt": "2026-03-30T10:00:00.000Z",
  "product": {
    "id": 20,
    "name": "Джинсовка SALIY чёрная",
    "price": 9500
  }
}
```

**Ошибки:**
- `404` - Товар не найден
- `400` - Товар недоступен или недостаточно на складе

---

### 3. Обновить количество (авторизованные)

**PATCH** `/api/cart/items/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "quantity": 3
}
```

**Пример ответа:**
```json
{
  "id": 1,
  "userId": "uuid-123",
  "productId": 20,
  "size": "M",
  "quantity": 3,
  "updatedAt": "2026-03-30T11:00:00.000Z"
}
```

---

### 4. Удалить товар из корзины (авторизованные)

**DELETE** `/api/cart/items/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Товар удален из корзины"
}
```

---

### 5. Очистить корзину (авторизованные)

**DELETE** `/api/cart`

**Headers:**
```
Authorization: Bearer <token>
```

**Пример ответа:**
```json
{
  "success": true,
  "message": "Корзина очищена",
  "deletedCount": 3
}
```

---

### 6. Валидировать корзину (для всех)

**POST** `/api/cart/validate`

**Описание:** Возвращает актуальные цены, скидки и наличие товаров. Используется:
- Гостями - для отображения корзины с актуальными ценами
- Авторизованными - перед оформлением заказа
- Фронтом - для проверки наличия товаров на лету

**Body:**
```json
{
  "items": [
    {
      "productId": 20,
      "size": "M",
      "quantity": 2
    },
    {
      "productId": 21,
      "size": "L",
      "quantity": 1
    }
  ]
}
```

**Пример ответа:**
```json
{
  "items": [
    {
      "productId": 20,
      "productName": "Джинсовка SALIY чёрная",
      "productSlug": "dzhinsovka-saliy-black",
      "size": "M",
      "quantity": 2,
      "price": 9500,
      "discount": 0,
      "finalPrice": 9500,
      "totalPrice": 19000,
      "inStock": true,
      "availableQuantity": 5,
      "sizeChart": "https://storage.yandexcloud.net/saliy-shop/sizeChart/photo_2026-03-30_00-20-26.jpg",
      "imageUrl": "https://storage.yandexcloud.net/saliy-shop/products/dzhinsovka-black/Глеб фото 2.jpg"
    },
    {
      "productId": 21,
      "productName": "Джинсовка SALIY синяя",
      "productSlug": "dzhinsovka-saliy-blue",
      "size": "L",
      "quantity": 1,
      "price": 9500,
      "discount": 10,
      "finalPrice": 8550,
      "totalPrice": 8550,
      "inStock": true,
      "availableQuantity": 5,
      "sizeChart": "https://storage.yandexcloud.net/saliy-shop/sizeChart/photo_2026-03-30_00-20-26.jpg",
      "imageUrl": "https://storage.yandexcloud.net/saliy-shop/products/dzhinsovka-blue/Глеб фото син 1.jpg"
    }
  ],
  "subtotal": 27550,
  "total": 27550,
  "itemsCount": 3
}
```

**Важно:**
- Цены всегда берутся из БД, а не от клиента
- `inStock` показывает, достаточно ли товара на складе
- `availableQuantity` - доступное количество для заказа

---

### 7. Объединить корзину (авторизованные)

**POST** `/api/cart/merge`

**Описание:** Используется при входе пользователя для объединения корзины из localStorage с корзиной в БД.

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "items": [
    {
      "productId": 20,
      "size": "M",
      "quantity": 1
    }
  ]
}
```

**Пример ответа:**
```json
{
  "success": true,
  "addedCount": 1,
  "updatedCount": 0,
  "message": "Корзина объединена"
}
```

---

## 🔒 Безопасность

### ✅ Правильный подход (что мы делаем):

1. **Клиент отправляет только:**
   ```json
   {
     "productId": 20,
     "size": "M",
     "quantity": 2
   }
   ```

2. **Сервер берет из БД:**
   - Актуальную цену товара
   - Актуальную скидку
   - Наличие на складе
   - Информацию о товаре

3. **Сервер рассчитывает:**
   - Финальную цену со скидкой
   - Итоговую стоимость
   - Применяет промокод (если есть)

### ❌ Что НЕ делаем:

- ~~Не доверяем ценам от клиента~~
- ~~Не доверяем скидкам от клиента~~
- ~~Не доверяем финальной сумме от клиента~~
- ~~Не позволяем клиенту менять цены через localStorage~~

---

## GraphQL API

### Queries

**Получить корзину:**
```graphql
query {
  cart {
    id
    productId
    size
    quantity
    product {
      name
      price
      discount
    }
  }
}
```

**Валидировать корзину:**
```graphql
query ValidateCart($input: ValidateCartInput!) {
  validateCart(input: $input) {
    items {
      productId
      productName
      size
      quantity
      price
      finalPrice
      totalPrice
      inStock
      availableQuantity
    }
    subtotal
    total
    itemsCount
  }
}
```

### Mutations

**Добавить в корзину:**
```graphql
mutation {
  addToCart(productId: 20, size: "M", quantity: 2) {
    id
    quantity
  }
}
```

**Обновить количество:**
```graphql
mutation {
  updateCartItem(itemId: 1, quantity: 3) {
    id
    quantity
  }
}
```

**Удалить из корзины:**
```graphql
mutation {
  removeFromCart(itemId: 1)
}
```

**Очистить корзину:**
```graphql
mutation {
  clearCart
}
```

**Объединить корзину:**
```graphql
mutation MergeCart($items: [CartItemInput!]!) {
  mergeCart(items: $items)
}
```

---

## Примеры использования

### Сценарий 1: Гость добавляет товар

1. Фронт сохраняет в localStorage:
```javascript
const cart = [
  { productId: 20, size: "M", quantity: 2 }
];
localStorage.setItem('cart', JSON.stringify(cart));
```

2. При отображении корзины, фронт валидирует:
```bash
curl -X POST https://saliy-shop.ru/api/cart/validate \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 20, "size": "M", "quantity": 2}
    ]
  }'
```

3. При оформлении заказа, фронт отправляет:
```bash
curl -X POST https://saliy-shop.ru/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 20, "size": "M", "quantity": 2}
    ],
    "deliveryInfo": {...}
  }'
```

### Сценарий 2: Авторизованный пользователь

1. Добавить товар:
```bash
curl -X POST https://saliy-shop.ru/api/cart/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"productId": 20, "size": "M", "quantity": 2}'
```

2. Получить корзину:
```bash
curl https://saliy-shop.ru/api/cart \
  -H "Authorization: Bearer <token>"
```

3. Изменить количество:
```bash
curl -X PATCH https://saliy-shop.ru/api/cart/items/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 3}'
```

### Сценарий 3: Гость входит в аккаунт

1. Гость имеет корзину в localStorage
2. Гость входит в аккаунт
3. Фронт объединяет корзины:
```bash
curl -X POST https://saliy-shop.ru/api/cart/merge \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 20, "size": "M", "quantity": 2}
    ]
  }'
```
4. Корзина из localStorage добавляется к корзине в БД
5. Фронт очищает localStorage

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Недостаточно товара на складе / Товар недоступен |
| 401 | Требуется авторизация |
| 404 | Товар или элемент корзины не найден |
| 429 | Превышен лимит запросов |
| 500 | Ошибка сервера |
