# API подписки на рассылку (публичное)

**Базовый URL:** `/api/newsletter`

Подписаться на рассылку может **кто угодно** — авторизация не нужна, достаточно email и галочки согласия. Если введённый email совпадает с зарегистрированным пользователем — подписка автоматически связывается с его аккаунтом.

---

## Содержание

- [POST /api/newsletter/subscribe](#1-подписаться-на-рассылку) — подписаться (форма на сайте)
- [GET /api/newsletter/unsubscribe/:token](#2-отписаться-one-click) — отписка по ссылке из письма
- [Поведение и правила](#поведение-и-правила)

---

## 1. Подписаться на рассылку

**POST** `/api/newsletter/subscribe`

**Content-Type:** `application/json`

**Rate limit:** 5 запросов в минуту с одного IP — защита от спама.

### Тело запроса:

| Поле | Тип | Обяз. | Описание |
|---|---|---|---|
| `email` | string | ✅ | Email подписчика. Валидируется как email, переводится в lower-case при сохранении. |
| `acceptedTerms` | boolean | ✅ | Согласие с офертой и политикой конфиденциальности. **Должно быть `true`**, иначе `400`. |
| `source` | string | ❌ | Откуда подписка: `"footer"`, `"popup"`, `"checkout"` и т.п. (до 50 символов). Для аналитики. |

### Пример (curl):
```bash
curl -X POST https://saliy-shop.ru/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","acceptedTerms":true,"source":"footer"}'
```

### Пример (FormData / fetch):
```js
await fetch('/api/newsletter/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    acceptedTerms: true,
    source: 'footer',
  }),
});
```

### Response (новая подписка):
```json
{
  "alreadySubscribed": false,
  "message": "Спасибо за подписку",
  "subscriber": {
    "id": "uuid",
    "email": "user@example.com",
    "isActive": true,
    "acceptedTerms": true,
    "source": "footer",
    "userId": null,
    "subscribedAt": "2026-04-29T10:00:00.000Z",
    "unsubscribedAt": null
  }
}
```

### Response (повторная подписка, уже активен):
```json
{
  "alreadySubscribed": true,
  "message": "Вы уже подписаны"
}
```

### Response (был отписан → реактивация):
```json
{
  "alreadySubscribed": false,
  "message": "Подписка восстановлена",
  "subscriber": { "id": "...", "isActive": true, ... }
}
```

### Ошибки:
- `400 "Нужно согласиться с офертой и политикой конфиденциальности"` — `acceptedTerms !== true`
- `400 "Некорректный email"` — невалидный email-формат
- `429 Too Many Requests` — превышен rate-limit (5/мин)

---

## 2. Отписаться (one-click)

**GET** `/api/newsletter/unsubscribe/:token`

Используется для ссылок «Отписаться» в email-рассылках. Открывается прямо из почтового клиента в браузере и сразу деактивирует подписку.

### Параметры пути:
| Параметр | Описание |
|---|---|
| `token` | `unsubscribeToken` подписчика (уникальный, генерируется при подписке) |

### Что возвращает:
HTML-страничка с сообщением «Вы отписались от рассылки» и ссылкой обратно на сайт. **Не требует ни авторизации, ни подтверждения** — для соответствия требованию one-click unsubscribe.

### Идемпотентно:
- Уже отписан → «Вы уже отписаны»
- Токен не найден → «Подписка не найдена»

В обоих случаях возвращается статус `200` с HTML.

> **Если нужен JSON-вариант** для SPA-фронта: пока не сделан, скажи — добавлю отдельный `POST /api/newsletter/unsubscribe` с `{ token }` в теле.

---

## Поведение и правила

### Привязка к пользователю

Если email совпадает с email зарегистрированного пользователя, в подписчике автоматом проставляется `userId` — это позволяет админке видеть «этот юзер ещё и подписан на рассылку».

### Идемпотентность подписки

Один email = одна запись в БД (`email` имеет unique-индекс). Повторное обращение к `/subscribe`:
- `isActive: true` → ничего не меняет, возвращает «уже подписаны»
- `isActive: false` (был отписан) → реактивирует, обновляет `source` если передали новый

Дубликатов не создаётся.

### Юридические требования

- Поле `acceptedTerms: true` — обязательное (ФЗ 152 «О персональных данных», + GDPR-friendly).
- В каждом письме рассылки автоматически добавляется футер с unsubscribe-ссылкой:
  `https://saliy-shop.ru/api/newsletter/unsubscribe/{unsubscribe_token}`
- `acceptedTerms` сохраняется в БД как доказательство согласия.

### Что приходит подписчикам

Письма отправляются админом через [API кампаний](../Admin/campaigns.md) с типом аудитории `NEWSLETTER` — только активные подписчики из этой таблицы получают такие рассылки. Никаких автоматических писем после подписки **не отправляется** (нет double opt-in / welcome email — если нужно, скажу как добавить).

---

## Пример формы на сайте (React)

```jsx
function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!accepted) return;

    const res = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, acceptedTerms: true, source: 'footer' }),
    });
    const data = await res.json();
    setStatus(data.message);
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        type="email"
        placeholder="ЭЛЕКТРОННАЯ ПОЧТА"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" disabled={!accepted}>ПОДПИСАТЬСЯ</button>
      <label>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        Принимаю оферту и политику конфиденциальности
      </label>
      {status && <p>{status}</p>}
    </form>
  );
}
```
