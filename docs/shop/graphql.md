# GraphQL API

GraphQL Playground: `https://saliy-shop.ru/api/graphql`

GraphQL используется для **получения данных** (queries) - товары, категории, поиск.
REST API используется для **изменения данных** (создание/редактирование) и авторизации.

---

## Queries (Получение данных)

### Товары

#### 1. Получить список товаров

```graphql
query GetProducts(
  $categorySlug: String
  $gender: String
  $status: String
  $minPrice: Int
  $maxPrice: Int
  $inStock: Boolean
  $sortBy: String
  $sortOrder: String
  $limit: Int
  $offset: Int
) {
  products(
    categorySlug: $categorySlug
    gender: $gender
    status: $status
    minPrice: $minPrice
    maxPrice: $maxPrice
    inStock: $inStock
    sortBy: $sortBy
    sortOrder: $sortOrder
    limit: $limit
    offset: $offset
  ) {
    products {
      id
      name
      slug
      description
      cardStatus
      gender
      color
      weight
      price
      discount
      finalPrice
      images
      stock
      isActive
      viewCount
      salesCount
      createdAt
      updatedAt
      categories {
        id
        category {
          id
          name
          slug
          type
        }
      }
    }
    total
    limit
    offset
  }
}
```

**Variables:**
```json
{
  "categorySlug": "hoodies",
  "limit": 10,
  "offset": 0
}
```

**Пример ответа:**
```json
{
  "data": {
    "products": {
      "products": [
        {
          "id": 1,
          "name": "Чёрная толстовка оверсайз",
          "slug": "black-oversized-hoodie",
          "price": 6300,
          "discount": 0,
          "finalPrice": 6300,
          ...
        }
      ],
      "total": 1,
      "limit": 10,
      "offset": 0
    }
  }
}
```

---

#### 2. Получить товар по slug

```graphql
query GetProduct($slug: String!) {
  product(slug: $slug) {
    id
    name
    slug
    description
    cardStatus
    gender
    color
    weight
    price
    discount
    finalPrice
    images
    stock
    isActive
    viewCount
    salesCount
    createdAt
    updatedAt
    categories {
      id
      category {
        id
        name
        slug
        type
      }
    }
  }
}
```

**Variables:**
```json
{
  "slug": "black-oversized-hoodie"
}
```

---

#### 3. Поиск товаров

```graphql
query SearchProducts($query: String!) {
  searchProducts(query: $query) {
    id
    name
    slug
    description
    price
    discount
    finalPrice
    images
  }
}
```

**Variables:**
```json
{
  "query": "толстовка"
}
```

---

#### 4. Популярные товары

```graphql
query GetPopularProducts($limit: Int) {
  popularProducts(limit: $limit) {
    id
    name
    slug
    price
    discount
    finalPrice
    salesCount
    viewCount
    images
  }
}
```

**Variables:**
```json
{
  "limit": 10
}
```

---

#### 5. Товары в распродаже

```graphql
query GetSaleProducts($limit: Int) {
  saleProducts(limit: $limit) {
    id
    name
    slug
    cardStatus
    price
    discount
    finalPrice
    images
  }
}
```

---

#### 6. Новинки

```graphql
query GetNewProducts($limit: Int) {
  newProducts(limit: $limit) {
    id
    name
    slug
    cardStatus
    price
    discount
    finalPrice
    images
  }
}
```

---

### Категории

#### 1. Получить все категории

```graphql
query GetCategories {
  categories {
    id
    name
    slug
    type
    isActive
    createdAt
    updatedAt
  }
}
```

**Пример ответа:**
```json
{
  "data": {
    "categories": [
      {
        "id": 1,
        "name": "Толстовки",
        "slug": "hoodies",
        "type": "TOP",
        "isActive": true
      }
    ]
  }
}
```

---

#### 2. Получить категорию по slug

```graphql
query GetCategory($slug: String!) {
  category(slug: $slug) {
    id
    name
    slug
    type
    isActive
    createdAt
    updatedAt
  }
}
```

**Variables:**
```json
{
  "slug": "hoodies"
}
```

---

### Корзина

#### 1. Получить корзину пользователя (требует авторизации)

```graphql
query GetCart {
  cart {
    id
    productId
    size
    quantity
    createdAt
    updatedAt
    product {
      id
      name
      slug
      price
      finalPrice
      images
      stock
    }
  }
}
```

**Требуется заголовок:**
```
Authorization: Bearer <access_token>
```

---

#### 2. Валидировать корзину (для всех, включая гостей)

```graphql
query ValidateCart($items: [CartItemInput!]!) {
  validateCart(items: $items) {
    items {
      productId
      productName
      productSlug
      size
      quantity
      price
      finalPrice
      totalPrice
      inStock
      availableQuantity
      imageUrl
    }
    itemsCount
    subtotal
    total
  }
}
```

**Variables:**
```json
{
  "items": [
    {
      "productId": 20,
      "size": "M",
      "quantity": 2
    }
  ]
}
```

**Описание:** Проверяет актуальность цен и наличие товаров в корзине. Используется для гостей (данные из localStorage) и перед оформлением заказа.

---

#### 3. Добавить товар в корзину (требует авторизации)

```graphql
mutation AddToCart($productId: Int!, $size: String!, $quantity: Int!) {
  addToCart(productId: $productId, size: $size, quantity: $quantity) {
    id
    productId
    size
    quantity
  }
}
```

---

#### 4. Обновить количество товара (требует авторизации)

```graphql
mutation UpdateCartItem($itemId: Int!, $quantity: Int!) {
  updateCartItem(itemId: $itemId, quantity: $quantity) {
    id
    quantity
  }
}
```

---

#### 5. Удалить товар из корзины (требует авторизации)

```graphql
mutation RemoveFromCart($itemId: Int!) {
  removeFromCart(itemId: $itemId)
}
```

---

#### 6. Очистить корзину (требует авторизации)

```graphql
mutation ClearCart {
  clearCart
}
```

---

#### 7. Объединить корзину (требует авторизации)

```graphql
mutation MergeCart($items: [CartItemInput!]!) {
  mergeCart(items: $items)
}
```

**Описание:** Объединяет корзину из localStorage с корзиной в БД после авторизации пользователя.

---

### Профиль пользователя

#### 1. Получить профиль текущего пользователя (требует авторизации)

```graphql
query GetMe {
  me {
    id
    email
    firstName
    lastName
    middleName
    phone
    birthdate
    socialContact
    deliveryType
    cdekCityCode
    cdekPickupPointCode
    cityName
    countryName
    regionName
    postalCode
    fullAddress
    createdAt
    updatedAt
  }
}
```

**Требуется заголовок:**
```
Authorization: Bearer <access_token>
```

**Примечание:** Обновление профиля происходит через REST API (`PUT /api/auth/profile`).

---

## Типы данных

### Product

```graphql
type Product {
  id: Int!
  name: String!
  slug: String!
  description: String
  cardStatus: CardStatus!
  gender: GenderType!
  color: String
  weight: Float
  price: Float!
  discount: Int!
  finalPrice: Float!
  images: JSON!          # Массив объектов с url, isPreview, previewOrder
  stock: JSON!           # Объект с размерами и количеством: {"S": 10, "M": 5}
  sizeChart: JSON        # Размерная таблица (опционально)
  isActive: Boolean!
  viewCount: Int!
  salesCount: Int!
  createdAt: DateTime    # Nullable
  updatedAt: DateTime    # Nullable
  categories: [ProductCategory!]
}
```

**Пример images:**
```json
[
  {"url": "https://...", "isPreview": true, "previewOrder": 1},
  {"url": "https://...", "isPreview": true, "previewOrder": 2},
  {"url": "https://...", "isPreview": false, "previewOrder": null}
]
```

**Пример stock:**
```json
{"S": 10, "M": 5, "L": 0, "XL": 3}
```

### Category

```graphql
type Category {
  id: Int!
  name: String!
  slug: String!
  type: String!
  isActive: Boolean!
  createdAt: DateTime    # Nullable
  updatedAt: DateTime    # Nullable
}
```

### User

```graphql
type User {
  id: String!
  email: String!
  firstName: String
  lastName: String
  middleName: String
  phone: String
  birthdate: Date        # Формат: DD.MM.YYYY при обновлении через REST
  socialContact: String
  deliveryType: String   # "CDEK" или "POST"
  cdekCityCode: Int
  cdekPickupPointCode: String
  cityName: String
  countryName: String
  regionName: String
  postalCode: String
  fullAddress: String
  createdAt: DateTime
  updatedAt: DateTime
}
```

### CartItem

```graphql
type CartItem {
  id: Int!
  userId: String!
  productId: Int!
  size: String!
  quantity: Int!
  createdAt: DateTime
  updatedAt: DateTime
  product: Product!
}
```

### ValidatedCartItem

```graphql
type ValidatedCartItem {
  productId: Int!
  productName: String!
  productSlug: String!
  size: String!
  quantity: Int!
  price: Float!
  finalPrice: Float!
  totalPrice: Float!
  inStock: Boolean!
  availableQuantity: Int!
  sizeChart: String
  imageUrl: String!
}
```

### ValidatedCart

```graphql
type ValidatedCart {
  items: [ValidatedCartItem!]!
  itemsCount: Int!
  subtotal: Float!
  total: Float!
}
```

### Enums

```graphql
enum CardStatus {
  NONE
  NEW
  SALE
  SOLD_OUT
  PRE_ORDER
  COMING_SOON
}

enum GenderType {
  MALE
  FEMALE
  UNISEX
}
```

---

## Примеры использования

### Получить товары категории "Толстовки" с минимальными полями

```graphql
query {
  products(categorySlug: "hoodies", limit: 10) {
    products {
      id
      name
      slug
      price
      discount
      finalPrice
      images
    }
    total
  }
}
```

### Получить полную информацию о товаре

```graphql
query {
  product(slug: "black-oversized-hoodie") {
    id
    name
    description
    price
    discount
    finalPrice
    images
    stock
    categories {
      category {
        name
        slug
      }
    }
  }
}
```

### Получить топ-5 популярных товаров с категориями

```graphql
query {
  popularProducts(limit: 5) {
    id
    name
    slug
    price
    finalPrice
    salesCount
    categories {
      category {
        name
        type
      }
    }
  }
}
```

### Фильтрация товаров по цене и наличию

```graphql
query {
  products(
    categorySlug: "dzhinsovki"
    minPrice: 5000
    maxPrice: 15000
    inStock: true
    sortBy: "price"
    sortOrder: "asc"
    limit: 10
  ) {
    products {
      id
      name
      price
      finalPrice
      stock
    }
    total
  }
}
```

### Валидация корзины гостя перед оформлением

```graphql
query {
  validateCart(items: [
    {productId: 20, size: "M", quantity: 2},
    {productId: 21, size: "L", quantity: 1}
  ]) {
    items {
      productName
      size
      quantity
      finalPrice
      totalPrice
      inStock
      availableQuantity
    }
    total
    itemsCount
  }
}
```

### Получить профиль и корзину после авторизации

```graphql
query {
  me {
    id
    email
    firstName
    lastName
    phone
  }

  cart {
    id
    size
    quantity
    product {
      name
      price
      finalPrice
      images
    }
  }
}
```

**Требуется заголовок:**
```
Authorization: Bearer <access_token>
```

---

## Преимущества GraphQL

1. **Запрос только нужных полей** - клиент сам выбирает какие данные получить
2. **Один запрос вместо нескольких** - получить товар с категориями за один запрос
3. **Типизация** - автоматическая генерация типов для TypeScript
4. **Исследование API** - GraphQL Playground показывает все доступные queries

---

## Тестирование

### GraphQL Playground

Открой https://saliy-shop.ru/api/graphql в браузере.

Слева пиши queries, справа смотри результат.

### Пример в коде (TypeScript)

```typescript
const query = `
  query GetProducts($categorySlug: String!) {
    products(categorySlug: $categorySlug, limit: 10) {
      products {
        id
        name
        slug
        price
        finalPrice
      }
    }
  }
`;

const response = await fetch('https://saliy-shop.ru/api/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query,
    variables: { categorySlug: 'hoodies' }
  })
});

const data = await response.json();
```

---

## Когда использовать GraphQL vs REST

### Используй GraphQL для:
- **Получения товаров** с фильтрацией (categorySlug, gender, status, minPrice, maxPrice, inStock, sortBy, sortOrder)
- **Поиска товаров** по запросу
- **Получения категорий**
- **Получения профиля пользователя** (query `me`)
- **Работы с корзиной** (получение, добавление, обновление, удаление, валидация)
- **Валидации корзины гостя** перед оформлением заказа
- Когда нужны **разные наборы полей** в разных местах (гибкость GraphQL)

### Используй REST для:
- **Авторизации** (POST /api/auth/send-code, POST /api/auth/verify-code, POST /api/auth/refresh)
- **Обновления профиля** (PUT /api/auth/profile - в т.ч. дата рождения в формате DD.MM.YYYY)
- **Обновления адреса доставки** (PUT /api/auth/delivery-location)
- **Создания заказов** (POST /api/orders)
- **Админка** (создание/редактирование товаров, категорий, промокодов)
- **Загрузки файлов** (изображения товаров, баннеры)

### Особенности авторизации в GraphQL

Для queries и mutations, требующих авторизации, добавь JWT токен в заголовок:

```
Authorization: Bearer <access_token>
```

Получить access token можно через REST API:
1. POST /api/auth/send-code - отправка кода на email
2. POST /api/auth/verify-code - проверка кода и получение токенов

После авторизации доступны:
- `query { me }` - профиль пользователя
- `query { cart }` - корзина пользователя
- `mutation { addToCart }` - добавление в корзину
- `mutation { mergeCart }` - объединение корзины после входа

---

## Важные примечания

### Формат даты рождения

**В GraphQL:** поле `birthdate` возвращается как `Date` (ISO 8601 формат)
```json
{
  "birthdate": "2003-07-13T00:00:00.000Z"
}
```

**В REST API (обновление):** отправлять в формате `DD.MM.YYYY`
```json
{
  "birthdate": "13.07.2003"
}
```

Ограничение: дату рождения можно изменить только **раз в год**.

### Формат изображений (images)

Поле `images` теперь возвращает массив объектов:
```json
[
  {
    "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
    "isPreview": true,
    "previewOrder": 1
  },
  {
    "url": "https://storage.yandexcloud.net/saliy-shop/products/...",
    "isPreview": true,
    "previewOrder": 2
  }
]
```

### Nullable поля

Поля `createdAt` и `updatedAt` могут быть `null` в GraphQL ответах. Всегда проверяй наличие значения:

```typescript
if (product.createdAt) {
  const date = new Date(product.createdAt);
  // работаем с датой
}
```

### Валидация корзины

**Важно:** Всегда валидируй корзину перед оформлением заказа с помощью `validateCart`. Это гарантирует:
- Актуальные цены товаров
- Доступное количество на складе
- Товары все еще активны

```graphql
query {
  validateCart(items: $cartItems) {
    items {
      inStock
      availableQuantity
      finalPrice
    }
    total
  }
}
```
