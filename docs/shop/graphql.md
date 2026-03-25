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
  images: JSONObject!
  stock: JSONObject!
  isActive: Boolean!
  viewCount: Int!
  salesCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  categories: [ProductCategory!]
}
```

### Category

```graphql
type Category {
  id: Int!
  name: String!
  slug: String!
  type: String!
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
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
- Получения товаров с фильтрацией
- Поиска товаров
- Получения категорий
- Когда нужны разные наборы полей в разных местах

### Используй REST для:
- Авторизации (POST /api/auth/*)
- Создания/редактирования товаров (админка)
- Проверки остатков (GET /api/products/:id/stock)
- Загрузки файлов
