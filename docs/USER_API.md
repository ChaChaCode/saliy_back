# API пользователя

Документация по работе с профилем пользователя.

## Структура данных пользователя

```typescript
{
  id: string;              // UUID пользователя
  email: string;           // Email (уникальный)

  // Персональная информация
  firstName?: string;      // Имя
  lastName?: string;       // Фамилия
  middleName?: string;     // Отчество
  phone?: string;          // Телефон

  // Адрес доставки
  street?: string;         // Улица и номер дома
  apartment?: string;      // Квартира
  postalCode?: string;     // Почтовый индекс

  // CDEK локация (заполняется автоматически при выборе города)
  cdekCityCode?: number;      // Код города CDEK
  cdekCountryCode?: string;   // Код страны CDEK
  cdekRegionCode?: number;    // Код региона CDEK
  cityName?: string;          // Название города
  countryName?: string;       // Название страны
  regionName?: string;        // Название региона

  // Системные поля
  createdAt: Date;         // Дата регистрации
  updatedAt: Date;         // Дата последнего обновления
}
```

## Эндпоинты

### 1. Получить профиль текущего пользователя

**GET** `/api/auth/me`

**Требуется авторизация:** Да (Bearer Token)

**Описание:** Получить данные профиля авторизованного пользователя.

**Пример запроса:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "middleName": "Сергеевич",
  "phone": "+79991234567",
  "street": "ул. Ленина, д. 10",
  "apartment": "25",
  "postalCode": "123456",
  "cdekCityCode": 44,
  "cdekCountryCode": "RU",
  "cdekRegionCode": 77,
  "cityName": "Москва",
  "countryName": "Россия",
  "regionName": "Москва",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T14:25:00.000Z"
}
```

---

### 2. Обновить профиль пользователя

**PUT** `/api/auth/profile`

**Требуется авторизация:** Да (Bearer Token)

**Описание:** Обновить данные профиля авторизованного пользователя.

**Тело запроса:**
```typescript
{
  firstName?: string;      // Имя
  lastName?: string;       // Фамилия
  middleName?: string;     // Отчество
  phone?: string;          // Телефон
  street?: string;         // Улица и номер дома
  apartment?: string;      // Квартира
  postalCode?: string;     // Почтовый индекс
}
```

**Пример запроса:**
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "middleName": "Сергеевич",
    "phone": "+79991234567",
    "street": "ул. Пушкина, д. 5",
    "apartment": "12",
    "postalCode": "190000"
  }'
```

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "middleName": "Сергеевич",
  "phone": "+79991234567",
  "street": "ул. Пушкина, д. 5",
  "apartment": "12",
  "postalCode": "190000",
  "cdekCityCode": null,
  "cdekCountryCode": null,
  "cdekRegionCode": null,
  "cityName": null,
  "countryName": null,
  "regionName": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T15:45:00.000Z"
}
```

**Ошибки:**
- `400 Bad Request` - Некорректные данные
- `401 Unauthorized` - Не авторизован

---

### 3. Установить город доставки

**PUT** `/api/auth/delivery-location`

**Требуется авторизация:** Да (Bearer Token)

**Описание:** Установить город доставки пользователя. При установке автоматически заполняются коды CDEK и названия города/страны/региона.

**Тело запроса:**
```typescript
{
  cdekCityCode: number;    // Код города CDEK
}
```

**Пример запроса:**
```bash
curl -X PUT http://localhost:3000/api/auth/delivery-location \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cdekCityCode": 44
  }'
```

**Пример ответа:**
```json
{
  "id": "uuid-123",
  "email": "user@example.com",
  "firstName": "Иван",
  "lastName": "Петров",
  "cdekCityCode": 44,
  "cdekCountryCode": "RU",
  "cdekRegionCode": 77,
  "cityName": "Москва",
  "countryName": "Россия",
  "regionName": "Москва",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-20T16:00:00.000Z"
}
```

**Ошибки:**
- `400 Bad Request` - Некорректный код города
- `401 Unauthorized` - Не авторизован
- `404 Not Found` - Город не найден в CDEK

---

## Валидация данных

### Телефон
- Формат: международный формат с кодом страны
- Пример: `+79991234567`
- Валидация: опциональна

### Email
- Формат: стандартный email
- Уникальность: да
- Изменение: нельзя изменить (используется для авторизации)

### Имя, Фамилия, Отчество
- Минимальная длина: 1 символ
- Максимальная длина: 100 символов
- Валидация: опциональна

### Адрес доставки
- Все поля опциональны
- Рекомендуется заполнять для оформления заказов

### CDEK локация
- Заполняется автоматически при выборе города
- Используется для расчета стоимости доставки
- Изменяется через эндпоинт `/api/auth/delivery-location`

---

## Примеры использования

### Полный цикл работы с профилем

1. **Регистрация и авторизация:**
```bash
# Отправить код на email
curl -X POST http://localhost:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Подтвердить код и получить токен
curl -X POST http://localhost:3000/api/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "code": "1234"}'
```

2. **Получить профиль:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

3. **Заполнить персональные данные:**
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Петров",
    "middleName": "Сергеевич",
    "phone": "+79991234567"
  }'
```

4. **Выбрать город доставки:**
```bash
# Сначала найти город через API доставки
curl -X GET "http://localhost:3000/api/delivery/cities?query=Москва"

# Затем установить выбранный город
curl -X PUT http://localhost:3000/api/auth/delivery-location \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cdekCityCode": 44}'
```

5. **Указать адрес доставки:**
```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "ул. Пушкина, д. 5",
    "apartment": "12",
    "postalCode": "190000"
  }'
```

---

## Безопасность

### Авторизация
- Все эндпоинты (кроме авторизации) требуют Bearer Token
- Access Token действителен 15 минут
- Refresh Token действителен 7 дней
- Refresh Token хранится в httpOnly cookie

### Приватность данных
- Пользователь может видеть и редактировать только свои данные
- Email нельзя изменить
- История заказов доступна только владельцу

### Валидация
- Все входящие данные валидируются
- Некорректные данные возвращают ошибку 400
- SQL-инъекции предотвращены через Prisma ORM

---

## Интеграция с другими модулями

### Модуль заказов
- При оформлении заказа используются данные профиля
- Адрес доставки берется из профиля
- Телефон берется из профиля

### Модуль доставки
- CDEK коды используются для расчета стоимости доставки
- Город доставки должен быть установлен для оформления заказа

### Модуль товаров
- История просмотров привязана к пользователю
- Избранные товары привязаны к пользователю (будет добавлено)

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 400 | Некорректные данные |
| 401 | Не авторизован |
| 404 | Не найдено |
| 500 | Внутренняя ошибка сервера |

---

## Примечания

### Обязательные поля для оформления заказа
Для успешного оформления заказа должны быть заполнены:
- `firstName` - Имя
- `lastName` - Фамилия
- `phone` - Телефон
- `cdekCityCode` - Город доставки
- `street` - Адрес доставки

### Рекомендации по UX
1. Запрашивать персональные данные при первом заказе
2. Предлагать автозаполнение при повторных заказах
3. Показывать прогресс заполнения профиля
4. Валидировать данные на клиенте до отправки
5. Сохранять изменения автоматически

---

## TODO (в разработке)

Эндпоинты, которые будут добавлены:
- [ ] `PUT /api/auth/profile` - Обновление профиля
- [ ] `PUT /api/auth/delivery-location` - Установка города доставки
- [ ] `GET /api/auth/orders` - История заказов пользователя
- [ ] `GET /api/auth/favorites` - Избранные товары
- [ ] `POST /api/auth/favorites/:productId` - Добавить в избранное
- [ ] `DELETE /api/auth/favorites/:productId` - Удалить из избранного
