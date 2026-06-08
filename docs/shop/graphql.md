# GraphQL API

GraphQL-эндпоинт: **POST** `/api/graphql` (полный URL `https://saliystudio.com/api/graphql`). В режиме разработки по этому же адресу доступна интерактивная Playground-консоль в браузере.

GraphQL используется для **получения данных** (queries) — товары, категории, поиск, профиль, корзина. REST API используется для **изменения данных** (создание/редактирование заказов, профиля) и авторизации.

**Авторизация:** запросы, требующие авторизации, используют токен из httpOnly cookie `accessToken` — он отправляется браузером автоматически. Заголовок `Authorization: Bearer <token>` также принимается для совместимости.

---

## Queries (Получение данных)

### Товары

#### 1. products — список товаров

Query `products` принимает аргументы фильтрации и пагинации:

| Аргумент | Тип | Описание |
|---|---|---|
| `categorySlug` | String | Фильтр по slug категории |
| `gender` | String | Пол: `MALE` / `FEMALE` / `UNISEX` |
| `status` | String | Статус карточки товара |
| `minPrice` | Int | Минимальная цена |
| `maxPrice` | Int | Максимальная цена |
| `inStock` | Boolean | Только товары в наличии |
| `sortBy` | String | Поле сортировки (например `price`) |
| `sortOrder` | String | Направление: `asc` / `desc` |
| `limit` | Int | Количество элементов |
| `offset` | Int | Смещение |

Возвращает объект с полями: `products` (массив товаров, см. тип Product), `total`, `limit`, `offset`. Внутри каждого товара доступны все поля типа Product, включая вложенные `categories { category { id name slug type } }`.

#### 2. product — товар по slug

Query `product(slug: String!)` возвращает один товар (тип Product) со всеми полями, включая вложенные категории.

#### 3. searchProducts — поиск товаров

Query `searchProducts(query: String!)` возвращает массив товаров (тип Product), подходящих под поисковую строку.

#### 4. popularProducts — популярные товары

Query `popularProducts(limit: Int)` возвращает массив популярных товаров (по `salesCount` / `viewCount`).

#### 5. saleProducts — товары в распродаже

Query `saleProducts(limit: Int)` возвращает массив товаров со скидкой.

#### 6. newProducts — новинки

Query `newProducts(limit: Int)` возвращает массив новинок.

---

### Категории

#### 1. categories — все категории

Query `categories` возвращает массив всех категорий (тип Category).

#### 2. category — категория по slug

Query `category(slug: String!)` возвращает одну категорию (тип Category).

---

### Корзина

#### 1. cart — корзина пользователя (требует авторизации)

Query `cart` возвращает массив элементов корзины (тип CartItem) с вложенным товаром `product`. Требует авторизации (токен в httpOnly cookie, отправляется браузером автоматически).

#### 2. validateCart — валидация корзины (для всех, включая гостей)

Query `validateCart(items: [CartItemInput!]!)` принимает массив элементов корзины. Каждый элемент `CartItemInput`: `productId` (Int), `size` (String), `quantity` (Int).

Возвращает объект ValidatedCart с полями `items` (массив ValidatedCartItem), `itemsCount`, `subtotal`, `total`. Проверяет актуальность цен и наличие товаров. Используется для гостей (данные из localStorage) и перед оформлением заказа.

#### 3. addToCart — добавить товар (mutation, требует авторизации)

Mutation `addToCart(productId: Int!, size: String!, quantity: Int!)` возвращает добавленный элемент (тип CartItem).

#### 4. updateCartItem — обновить количество (mutation, требует авторизации)

Mutation `updateCartItem(itemId: Int!, quantity: Int!)` возвращает обновлённый элемент (тип CartItem).

#### 5. removeFromCart — удалить товар (mutation, требует авторизации)

Mutation `removeFromCart(itemId: Int!)` возвращает Boolean (успех операции).

#### 6. clearCart — очистить корзину (mutation, требует авторизации)

Mutation `clearCart` возвращает Boolean.

#### 7. mergeCart — объединить корзину (mutation, требует авторизации)

Mutation `mergeCart(items: [CartItemInput!]!)` возвращает Boolean. Объединяет корзину из localStorage с корзиной в БД после авторизации пользователя.

---

### Профиль пользователя

#### me — профиль текущего пользователя (требует авторизации)

Query `me` возвращает профиль текущего пользователя (тип User) со всеми полями: `id`, `email`, `firstName`, `lastName`, `middleName`, `phone`, `birthdate`, `socialContact`, `deliveryType`, `cdekCityCode`, `cdekPickupPointCode`, `cityName`, `countryName`, `regionName`, `postalCode`, `fullAddress`, `createdAt`, `updatedAt`. Требует авторизации (токен в httpOnly cookie).

Обновление профиля происходит через REST API (**PUT** `/api/auth/profile`).

---

## Типы данных

### Product

| Поле | Тип | Описание |
|---|---|---|
| `id` | Int! | ID товара |
| `name` | String! | Название |
| `slug` | String! | Slug |
| `description` | String | Описание |
| `cardStatus` | CardStatus! | Статус карточки |
| `gender` | GenderType! | Пол |
| `color` | String | Цвет |
| `weight` | Float | Вес |
| `price` | Float! | Цена |
| `discount` | Int! | Скидка (%) |
| `finalPrice` | Float! | Итоговая цена |
| `images` | JSON! | Массив объектов с `url`, `isPreview`, `previewOrder` |
| `stock` | JSON! | Объект «размер → количество», например `{"S": 10, "M": 5}` |
| `isActive` | Boolean! | Активен ли товар |
| `viewCount` | Int! | Просмотры |
| `salesCount` | Int! | Продажи |
| `createdAt` | DateTime | Дата создания (может быть null) |
| `updatedAt` | DateTime | Дата обновления (может быть null) |
| `categories` | [ProductCategory!] | Связанные категории |

### Category

| Поле | Тип | Описание |
|---|---|---|
| `id` | Int! | ID |
| `name` | String! | Название |
| `slug` | String! | Slug |
| `type` | String! | Тип категории |
| `isActive` | Boolean! | Активна ли |
| `createdAt` | DateTime | Может быть null |
| `updatedAt` | DateTime | Может быть null |

### User

| Поле | Тип | Описание |
|---|---|---|
| `id` | String! | ID |
| `email` | String! | Email |
| `firstName` | String | Имя |
| `lastName` | String | Фамилия |
| `middleName` | String | Отчество |
| `phone` | String | Телефон |
| `birthdate` | Date | Дата рождения (при обновлении через REST — формат DD.MM.YYYY) |
| `socialContact` | String | Контакт в соцсети |
| `deliveryType` | String | `CDEK` или `POST` |
| `cdekCityCode` | Int | Код города CDEK |
| `cdekPickupPointCode` | String | Код пункта выдачи CDEK |
| `cityName` | String | Город |
| `countryName` | String | Страна |
| `regionName` | String | Регион |
| `postalCode` | String | Индекс |
| `fullAddress` | String | Полный адрес |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |

### CartItem

| Поле | Тип | Описание |
|---|---|---|
| `id` | Int! | ID элемента корзины |
| `userId` | String! | ID пользователя |
| `productId` | Int! | ID товара |
| `size` | String! | Размер |
| `quantity` | Int! | Количество |
| `createdAt` | DateTime | Дата создания |
| `updatedAt` | DateTime | Дата обновления |
| `product` | Product! | Связанный товар |

### ValidatedCartItem

| Поле | Тип | Описание |
|---|---|---|
| `productId` | Int! | ID товара |
| `productName` | String! | Название |
| `productSlug` | String! | Slug |
| `size` | String! | Размер |
| `quantity` | Int! | Количество |
| `price` | Float! | Цена |
| `finalPrice` | Float! | Итоговая цена за единицу |
| `totalPrice` | Float! | Итоговая цена позиции |
| `inStock` | Boolean! | В наличии ли |
| `availableQuantity` | Int! | Доступное количество |
| `imageUrl` | String! | URL изображения |

### ValidatedCart

| Поле | Тип | Описание |
|---|---|---|
| `items` | [ValidatedCartItem!]! | Позиции |
| `itemsCount` | Int! | Количество позиций |
| `subtotal` | Float! | Сумма без учёта доставки |
| `total` | Float! | Итого |

### Enums

**CardStatus:** `NONE`, `NEW`, `SALE`, `SOLD_OUT`, `PRE_ORDER`, `COMING_SOON`.

**GenderType:** `MALE`, `FEMALE`, `UNISEX`.

---

## Преимущества GraphQL

1. **Запрос только нужных полей** — клиент сам выбирает, какие данные получить.
2. **Один запрос вместо нескольких** — получить товар с категориями за один запрос.
3. **Типизация** — автоматическая генерация типов для TypeScript.
4. **Исследование API** — Playground показывает все доступные queries и mutations.

---

## Когда использовать GraphQL vs REST

### Используй GraphQL для:

- получения товаров с фильтрацией (`categorySlug`, `gender`, `status`, `minPrice`, `maxPrice`, `inStock`, `sortBy`, `sortOrder`);
- поиска товаров по запросу;
- получения категорий;
- получения профиля пользователя (query `me`);
- работы с корзиной (получение, добавление, обновление, удаление, валидация);
- валидации корзины гостя перед оформлением заказа;
- когда нужны разные наборы полей в разных местах.

### Используй REST для:

- авторизации (**POST** `/api/auth/send-code`, **POST** `/api/auth/verify-code`, **POST** `/api/auth/refresh`);
- обновления профиля (**PUT** `/api/auth/profile`, в т.ч. дата рождения в формате DD.MM.YYYY);
- обновления адреса доставки (**PUT** `/api/auth/delivery-location`);
- создания заказов (**POST** `/api/orders`);
- админки (создание/редактирование товаров, категорий, промокодов);
- загрузки файлов (изображения товаров, баннеры).

### Особенности авторизации в GraphQL

Для queries и mutations, требующих авторизации, токен берётся из httpOnly cookie `accessToken` (отправляется браузером автоматически); заголовок `Authorization: Bearer <token>` также принимается для совместимости.

Получить токены можно через REST API:

1. **POST** `/api/auth/send-code` — отправка кода на email.
2. **POST** `/api/auth/verify-code` — проверка кода; сервер устанавливает токены в httpOnly cookie.

После авторизации доступны: query `me`, query `cart`, mutation `addToCart`, mutation `mergeCart` и остальные операции корзины.

---

## Важные примечания

### Формат даты рождения

- **В GraphQL:** поле `birthdate` возвращается как `Date` (ISO 8601, например `2003-07-13T00:00:00.000Z`).
- **В REST API (обновление):** отправлять в формате `DD.MM.YYYY` (например `13.07.2003`).

Ограничение: дату рождения можно изменить только **раз в год**.

### Формат изображений (images)

Поле `images` возвращает массив объектов, каждый из которых содержит: `url` (полный URL на S3-хосте), `isPreview` (boolean), `previewOrder` (number или null).

### Nullable поля

Поля `createdAt` и `updatedAt` могут быть `null` в GraphQL-ответах — всегда проверяй наличие значения перед использованием.

### Валидация корзины

Всегда валидируй корзину перед оформлением заказа с помощью query `validateCart`. Это гарантирует актуальные цены, доступное количество на складе и активность товаров.
