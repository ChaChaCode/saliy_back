# Документация frontend Saliy Studio

Актуализировано **8 ноября 2026**, часовой пояс — Екатеринбург (UTC+5).

Начать с [актуального handoff для витрины и админки](frontend-handoff.md).
Что изменилось за сегодня: [отчёт за 8 ноября](../changes-2026-11-08.md).

## Адреса и базовые правила

- Магазин: `https://saliystudio.com`.
- Админка: `https://admin.saliystudio.com`.
- API в браузере: относительный `/api`; SSR: `API_URL=http://127.0.0.1:3000/api`.
- Если API-клиент уже добавляет `/api`, в сервисах указывать `/products`, а не `/api/products`.
- Сессия покупателя — httpOnly cookie Better Auth. Передавать `credentials: 'include'`.
- Новый заказ оплачивается через Т-Банк, `paymentMethod: 'CARD_ONLINE'`.
- Итоги заказа, наличие и подтверждение оплаты брать из API.

## Контракты API

| Раздел | Документ |
| --- | --- |
| Вход, сессия и выход | [Better Auth](better-auth.md), [обзор авторизации](auth.md) |
| Профиль и адрес | [Покупатель](user.md) |
| Каталог и категории | [Товары](products.md), [категории](categories.md) |
| Актуальная/старая цена, OS | [Handoff](frontend-handoff.md), [админский API товаров](../Admin/products.md) |
| Корзина и проверка цен | [Корзина](cart.md) |
| Доставка и ПВЗ | [Доставка](delivery.md) |
| Расчёт, создание и история заказов | [Заказы](orders.md) |
| Оплата и возврат из банка | [Оплата](payment.md), [handoff Т-Банка](tbank-frontend-handoff.md) |
| Предзаказы | [Контракт и ограничения](preorders.md) |
| Промокоды | [Промокоды](promo.md) |
| Отзывы | [Отзывы](reviews.md) |
| Рассылка | [Рассылка](newsletter.md) |
| Баннеры и бегущая строка | [Баннеры](banners.md), [баннер шапки](header-banner.md) |
| Изображения и форматы | [Изображения](images.md) |

## Быстрый старт

1. Загрузить каталог: `GET /api/products` и `GET /api/categories`.
2. Для входа отправить код: `POST /api/session/email-otp/send-verification-otp`
   с `{ email, type: 'sign-in' }`; подтвердить через `POST /api/session/sign-in/email-otp`
   с `{ email, otp }`.
3. Проверить сессию: `GET /api/session/get-session`; профиль: `GET /api/auth/me`.
   Выход: `POST /api/session/sign-out`. Старых JWT refresh-маршрутов нет.
4. Проверить корзину: `POST /api/cart/validate`. Хранить у клиента только
   `productId`, `size`, `quantity`; использовать серверные цены и наличие.
5. Получить способы доставки/оплаты: `GET /api/orders/delivery-options?country=RU`.
6. Рассчитать и создать заказ: `POST /api/orders/calculate`, `POST /api/orders`.
7. Перейти на возвращённый `paymentUrl`; после возврата проверить заказ
   через `GET /api/orders/:orderNumber`. URL страницы успеха не доказывает оплату.

## Ошибки

Обычные REST-ошибки Nest содержат `statusCode`, `message` (строка или массив)
и `error`. Better Auth может возвращать собственные `code`/`message`.
Показывать понятное сообщение и сохранять введённые данные при сетевой ошибке.
Учитывать `400`, `401`, `403`, `404`, `413`, `429`, `5xx`.

Таймаут изменения данных не означает, что сервер ничего не сохранил.
Перед повторной загрузкой фото перечитать карточку; не повторять автоматически
создание заказа или товара после потери ответа.
