# Nginx: продакшн-конфигурация фронта, API и SPA-админки

Универсальная методика для VPS с nginx (1.24+), где за одним доменом живут:
фронт на Node (SSR), API на Node, статическая SPA-админка. Плейсхолдеры в
угловых скобках заменяются под конкретный проект. Готовые конфиги под текущий
проект лежат рядом — в `deploy/nginx/`.

## Плейсхолдеры

| Плейсхолдер | Что это | Пример (saliyclothes) |
|---|---|---|
| `<DOMAIN>` | основной домен | saliyclothes.com |
| `<ADMIN_DOMAIN>` | домен админки | admin.saliyclothes.com |
| `<API_PORT>` | порт бэкенда (Node) | 3000 |
| `<FRONT_PORT>` | порт фронта (Node SSR) | 3001 |
| `<FRONT_STATIC>` | путь к статике сборки фронта на диске | /home/deploy/apps/<app>/.next/static |
| `<ADMIN_ROOT>` | root собранной SPA-админки (dist) | /home/deploy/apps/<admin>/dist |
| `<ADMIN_ASSETS>` | подпапка иммутабельных ассетов админки | /assets/ |

Порт бэкенда — это то, что реально слушает процесс на сервере (проверять по
pm2/`.env` на сервере, а не по локальному .env: значения могут расходиться).
Конфиг nginx обязан совпадать с фактическим портом процесса.

## Принципы

1. **Nginx отдаёт статику с диска, Node только рендерит.** Иммутабельные
   ассеты сборки (хэш в имени) отдаём напрямую с диска, минуя Node-процесс —
   быстрее и разгружает SSR.
2. **Сжатие обязательно.** Стоковый nginx сжимает только HTML (`gzip_types`
   закомментирован). JS/CSS/JSON без сжатия через дросселируемые каналы
   (РФ-провайдеры) грузятся медленно — включаем сжатие явно.
3. **HTTP/2.** Один мультиплексированный коннект вместо шести параллельных
   HTTP/1.1. Включается директивой `http2 on;` (nginx 1.24+), не суффиксом
   в `listen`.
4. **Keepalive к upstream.** Через `upstream { keepalive N; }` +
   `proxy_http_version 1.1` + `Connection ""`. Иначе nginx открывает новое
   TCP-соединение к Node на каждый запрос.
5. **Connection через map, а не наглухо.** `proxy_set_header Connection` для
   websocket требует `upgrade`, для обычных запросов — пустую строку (иначе
   ломается keepalive). Управляется `map $http_upgrade $connection_upgrade`.
6. **Security-заголовки.** Для страниц фронта/админки — в nginx. Для API —
   в самом бэкенде (helmet), в nginx на API не дублировать. HSTS — единая
   политика на всех доменах.
7. **Бэкенд за прокси — trust proxy.** Node должен доверять `X-Forwarded-*`
   только от локального nginx (`loopback`), иначе неверно вычисляет HTTPS/IP,
   а внешний клиент может подделать IP (обход rate-limit).
8. **Rate-limit на API в nginx — грубый внешний слой** поверх тонкого
   лимита в приложении (throttler). Не замена, а первая линия против флуда.

## 1. Глобальный http-блок

Внутри `http { }` в `/etc/nginx/nginx.conf` (или отдельным файлом
`/etc/nginx/conf.d/00-tuning.conf`, он подключается автоматически):

- `gzip on` + `gzip_vary on` + `gzip_types` со списком JS/CSS/JSON/SVG/шрифтов
  (HTML жмётся всегда, его в список не включать);
- `map $http_upgrade $connection_upgrade { default upgrade; '' ''; }`;
- `upstream` для API и фронта с `keepalive 32`;
- `limit_req_zone $binary_remote_addr zone=<zone>:10m rate=30r/s`;
- `server_tokens off` (не раскрывать версию nginx).

Точные значения — в `deploy/nginx/http-tuning.conf`.

## 2. Основной домен (фронт + API)

`server` на `443 ssl` + `http2 on`, SSL-строки от certbot. Внутри:

- **Security-заголовки** через `add_header ... always`: HSTS,
  X-Content-Type-Options nosniff, X-Frame-Options, Referrer-Policy,
  Permissions-Policy.
- **`location <FRONT_STATIC-префикс>`** → `alias <FRONT_STATIC>/` с
  `expires 1y` и `Cache-Control: immutable`, `access_log off`. Дублировать
  `nosniff` (свой add_header отменяет наследование серверных).
- **`location /api/`** → `proxy_pass` на upstream API, `Connection ""`
  (keepalive), проброс `Host`/`X-Real-IP`/`X-Forwarded-For`/`X-Forwarded-Proto`,
  `limit_req zone=<zone> burst=60 nodelay`.
- **`location /`** → `proxy_pass` на upstream фронта, `Connection
  $connection_upgrade` (keepalive + websocket), проброс тех же заголовков.

Отдельный `server` на `80` — редирект `301` на HTTPS.

Готовый файл: `deploy/nginx/<DOMAIN>.conf`.

## 3. Домен админки (статический SPA)

`server` на `443 ssl` + `http2 on`, `root <ADMIN_ROOT>`. Внутри:

- **Security-заголовки** (для админки X-Frame-Options: DENY — не встраивать
  в iframe).
- **`location <ADMIN_ASSETS>`** — иммутабельные ассеты, кэш на год.
- **`location /`** → `try_files $uri $uri/ /index.html` (SPA-fallback);
  `index.html` НЕ кэшировать (`no-cache`), иначе новый деплой не подхватится.
  Security-заголовки в этом location продублировать.

Готовый файл: `deploy/nginx/<ADMIN_DOMAIN>.conf`.

## 4. Бэкенд (Node/NestJS) — обязательные правки

В точке входа приложения:

- **`trust proxy` = loopback** — доверять прокси-заголовкам только от nginx.
- **helmet** — security-заголовки для API. CSP и HSTS в helmet отключить
  (CSP страниц и единый HSTS задаёт nginx), чтобы не конфликтовали.
- **compression** — сжатие JSON-ответов API (статику жмёт nginx).
- **disable x-powered-by** — не раскрывать, что это Express.
- **CORS — белый список доменов** из переменной окружения, НЕ `origin: '*'`
  (с `credentials: true` звёздочка небезопасна и не работает в браузере).

## 5. Применение и проверка

1. Скопировать файлы из `deploy/nginx/` в `/etc/nginx/`:
   http-tuning → `conf.d/`, домены → `sites-available/` + симлинк в
   `sites-enabled/`. Пути в конфиге сверить с фактическими на сервере.
2. `sudo nginx -t` — проверка синтаксиса (обязательно перед reload).
3. `sudo systemctl reload nginx` — применение без разрыва соединений.
4. Проверить curl'ом (см. чек-лист ниже).

### Чек-лист проверки (curl)

| Что проверяем | Команда (суть) | Ожидаемо |
|---|---|---|
| Сжатие JS | запрос JS-чанка с `Accept-Encoding: gzip` | `Content-Encoding: gzip` |
| Сжатие API | запрос `/api/*` с `Accept-Encoding: gzip` | `Content-Encoding: gzip` |
| HTTP/2 | заголовки главной | `HTTP/2 200` |
| Security фронт | заголовки главной | HSTS, X-Frame-Options, nosniff, Referrer-Policy присутствуют |
| Security админка | заголовки админки | те же + X-Frame-Options: DENY |
| Статика с диска | заголовки ассета | `Cache-Control: ...immutable`, нет `X-Powered-By` |
| X-Powered-By убран | заголовки `/api/*` | заголовка `X-Powered-By` нет |
| Редирект HTTP→HTTPS | запрос по http | `301` на https |

## Частые ошибки

- **Сжатие «не работает».** HTML жмётся, а JS нет → `gzip_types` не задан
  (стоковый закомментирован). Добавить список типов.
- **HTTP/2 «не включается».** В новых nginx суффикс `listen 443 ssl http2`
  устарел — нужна отдельная директива `http2 on;`.
- **Пропали security-заголовки в конкретном location.** Любой `add_header`
  внутри `location` отменяет наследование серверных `add_header`. Дублировать
  в этом location.
- **Двойные заголовки на API.** Если и nginx, и helmet ставят один заголовок
  → выбрать один источник (для API — helmet).
- **Порт в конфиге не тот.** Локальный `.env` может отличаться от серверного.
  Источник истины — фактический порт процесса на сервере (pm2/серверный .env).
