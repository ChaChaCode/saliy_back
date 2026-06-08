#!/bin/bash

# Настройка Telegram webhook для админки.
# Токен и секрет читаются из .env (не хардкодим секреты в репозиторий).
# Запуск: ./setup_telegram_webhook.sh

set -euo pipefail

# Загружаем переменные из .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "❌ Файл .env не найден"
  exit 1
fi

: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN не задан в .env}"
: "${BACKEND_URL:?BACKEND_URL не задан в .env}"
: "${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET не задан в .env}"

WEBHOOK_URL="${BACKEND_URL%/}/admin/telegram/webhook"

echo "Настройка webhook для Telegram бота..."
echo "URL: $WEBHOOK_URL"

# Устанавливаем webhook с secret_token (защита от поддельных запросов)
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"}"

echo ""
echo ""
echo "Проверка webhook..."

curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"

echo ""
echo ""
echo "✅ Готово!"
