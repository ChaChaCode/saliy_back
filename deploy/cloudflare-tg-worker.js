// Релей Telegram Bot API для бэкенда SALIY (Cloudflare Worker).
// С сервера в РФ api.telegram.org открывается нестабильно, а Cloudflare —
// стабильно. Воркер пересылает запрос к Bot API как есть и возвращает ответ.
// Секрет PATH_SECRET (Settings → Variables and Secrets, тип Secret) стоит
// первым сегментом пути: без него воркер отвечает 404 и не работает как
// открытый прокси. Логи воркера выключить: токен бота — часть адреса запроса.
const UPSTREAM = 'https://api.telegram.org';

export default {
  async fetch(request, env) {
    const secret = env.PATH_SECRET;
    if (!secret || secret.length < 24) {
      return new Response('not configured', { status: 500 });
    }

    const url = new URL(request.url);
    const prefix = `/${secret}/`;
    if (!url.pathname.startsWith(prefix)) {
      return new Response('not found', { status: 404 });
    }

    const path = url.pathname.slice(prefix.length - 1);
    if (!/^\/(file\/)?bot\d+:[A-Za-z0-9_-]+\//.test(path)) {
      return new Response('not found', { status: 404 });
    }

    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'accept']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    return fetch(UPSTREAM + path + url.search, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });
  },
};
