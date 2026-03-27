#!/bin/bash

# Настройка Telegram webhook для админки

BOT_TOKEN="8488379985:AAGobKg7euDd21V22-k_r0F31eCHGjv2lrY"
WEBHOOK_URL="https://saliy-shop.ru/api/admin/telegram/webhook"

echo "Настройка webhook для Telegram бота..."
echo "URL: $WEBHOOK_URL"

# Устанавливаем webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}"

echo ""
echo ""
echo "Проверка webhook..."

# Проверяем статус webhook
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

echo ""
echo ""
echo "✅ Готово!"
