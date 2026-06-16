# API админ-панели: Пользователи

**Базовый URL:** `/api/admin/users`

**Авторизация:** все эндпоинты требуют авторизации администратора (`AdminGuard`). Запросы авторизуются через httpOnly cookie `adminToken`, которую браузер отправляет автоматически (заголовок `Authorization` также принимается для обратной совместимости).

Админ видит полный профиль пользователя: контакты, адрес, способ доставки, историю заказов с составом, оставленные отзывы, агрегаты (сколько потратил, когда последний заказ).

---

## 1. Статистика пользователей

**GET** `/api/admin/users/stats`

| Поле ответа | Описание |
|-------------|----------|
| `total` | Всего пользователей |
| `newToday` | Зарегистрировано сегодня |
| `newThisMonth` | Зарегистрировано в этом месяце |
| `withOrders` | С заказами |
| `withoutOrders` | Без заказов |

---

## 2. Список пользователей

**GET** `/api/admin/users`

Плоский список с агрегатами `ordersCount` / `totalSpent` / `lastOrderAt` по каждому пользователю — удобно для «топ покупателей».

| Параметр | Тип | Описание |
|----------|-----|----------|
| `search` | string | Поиск по email, `name`, `firstName`, `lastName`, `phone` (case-insensitive) |
| `dateFrom` / `dateTo` | ISO date | Диапазон регистрации |
| `hasOrders` | true \| false | Только с заказами / только без заказов |
| `sortBy` | `createdAt` \| `ordersCount` \| `totalSpent` \| `lastOrderAt` | По умолчанию `createdAt` |
| `sortOrder` | asc \| desc | По умолчанию `desc` |
| `page`, `limit` | number | Пагинация (default 1 / 20) |

Ответ: объект с полями `users` (массив пользователей с агрегатами) и `pagination`.

Примечания: сортировки по агрегатам (`ordersCount`/`totalSpent`/`lastOrderAt`) выполняются в памяти после фильтрации — на больших объёмах может быть медленно; для `createdAt` сортировка идёт в БД. `totalSpent` считается по оплаченным заказам (`isPaid=true`) в статусах ≠ `CANCELLED`.

---

## 3. Полная карточка пользователя

**GET** `/api/admin/users/:id`

Ответ содержит:

| Секция | Описание |
|--------|----------|
| Базовые поля | `id`, `email`, `name`, `firstName`, `lastName`, `middleName`, `phone`, `avatarUrl`, `birthdate`, `socialContact` |
| `address` | Адрес: `street`, `apartment`, `postalCode`, `countryName`, `regionName`, `cityName`, `fullAddress` (полный адрес одной строкой для почтовой доставки) |
| `delivery` | Настройки доставки: `deliveryType`, `deliveryCountryCode`, `cdekCityCode`, `cdekCountryCode`, `cdekRegionCode`, `cdekPickupPointCode` |
| `stats` | Агрегаты: `ordersCount`, `cartItemsCount`, `totalSpent`, `lastOrderAt` |
| `orders` | Все заказы клиента с составом (`items`) — как привязанные к аккаунту, так и гостевые на ту же почту (что были оформлены до регистрации). `totalSpent` тоже учитывает заказы по почте. Полная инфа по заказу — `GET /api/admin/orders/:orderNumber` |
| `reviews` | Отзывы пользователя с привязкой к товару и статусом модерации (`PENDING` / `APPROVED` / `REJECTED`) |

Ошибки: `404` — пользователь не найден.

---

## 4. Удалить пользователя

**DELETE** `/api/admin/users/:id`

Физическое удаление пользователя в транзакции:
- Удаляются: refresh-токены, verification codes, корзина (cascade).
- Заказы сохраняются с `userId = null` (бухгалтерия не теряется).
- Отзывы сохраняются с `userId = null` (оставленные отзывы остаются на товаре).

Ответ: `success: true` и сообщение. Ошибки: `404` — пользователь не найден.
