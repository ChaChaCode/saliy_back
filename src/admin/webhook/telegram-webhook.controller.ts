import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AdminAuthService } from '../auth/admin-auth.service';
import { SimpleCacheService } from '../../common/cache/simple-cache.service';

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
    };
    message: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

@Controller('admin/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private adminAuthService: AdminAuthService,
    private cacheService: SimpleCacheService,
  ) {}

  /**
   * Webhook для обработки callback из Telegram
   * POST /admin/telegram/webhook
   */
  @Post('webhook')
  async handleWebhook(@Body() update: TelegramUpdate) {
    this.logger.log(`Received Telegram update: ${JSON.stringify(update)}`);

    if (!update.callback_query) {
      return { ok: true };
    }

    const { callback_query } = update;
    const data = callback_query.data;

    try {
      // Обработка подтверждения входа
      if (data.startsWith('admin_approve:')) {
        const loginId = data.split(':')[1];

        // Получаем данные подтверждающего из Telegram
        const telegramUserId = callback_query.from.id.toString();
        const telegramUserName = callback_query.from.first_name;

        // Подтверждаем вход (создаст админа если нужно)
        await this.adminAuthService.approveLoginByTelegram(
          loginId,
          telegramUserId,
          telegramUserName,
        );

        // Обновляем сообщение в Telegram
        await this.updateTelegramMessage(
          callback_query.message.chat.id,
          callback_query.message.message_id,
          `✅ *Вход подтверждён*\n\nПодтвердил: ${telegramUserName}\nПользователь авторизован.`,
          [
            [
              {
                text: '🔓 Отозвать',
                callback_data: `admin_revoke:${loginId}`,
              },
            ],
          ],
        );

        this.logger.log(`Login approved: ${loginId} by Telegram user ${telegramUserId}`);
      }

      // Обработка блокировки IP
      else if (data.startsWith('admin_block:')) {
        const ip = data.split(':')[1];

        // Блокируем IP навсегда
        const blockKey = `admin:permanent_block:${ip}`;
        await this.cacheService.set(
          blockKey,
          {
            blockedAt: new Date().toISOString(),
            reason: 'Заблокировано через Telegram',
          },
          365 * 24 * 60 * 60 * 1000, // 1 год
        );

        // Обновляем сообщение
        await this.updateTelegramMessage(
          callback_query.message.chat.id,
          callback_query.message.message_id,
          `🚫 *IP заблокирован*\n\nIP \`${ip}\` заблокирован навсегда.`,
          [
            [
              {
                text: '🔓 Разблокировать',
                callback_data: `admin_unblock:${ip}`,
              },
            ],
          ],
        );

        this.logger.log(`IP blocked permanently: ${ip}`);
      }

      // Обработка разблокировки IP
      else if (data.startsWith('admin_unblock:')) {
        const ip = data.split(':')[1];

        // Удаляем временную блокировку
        const tempBlockKey = `admin:failed_attempts:${ip}`;
        await this.cacheService.delete(tempBlockKey);

        // Удаляем постоянную блокировку
        const permBlockKey = `admin:permanent_block:${ip}`;
        await this.cacheService.delete(permBlockKey);

        // Обновляем сообщение
        await this.updateTelegramMessage(
          callback_query.message.chat.id,
          callback_query.message.message_id,
          `🔓 *IP разблокирован*\n\nIP \`${ip}\` разблокирован.`,
          [
            [
              {
                text: '🚫 Заблокировать',
                callback_data: `admin_block:${ip}`,
              },
            ],
          ],
        );

        this.logger.log(`IP unblocked: ${ip}`);
      }

      // Обработка блокировки после брутфорса
      else if (data.startsWith('admin_block_bruteforce:')) {
        const ip = data.split(':')[1];

        // Блокируем навсегда
        const blockKey = `admin:permanent_block:${ip}`;
        await this.cacheService.set(
          blockKey,
          {
            blockedAt: new Date().toISOString(),
            reason: 'Попытка брутфорса',
          },
          365 * 24 * 60 * 60 * 1000,
        );

        await this.updateTelegramMessage(
          callback_query.message.chat.id,
          callback_query.message.message_id,
          `🚫 *IP заблокирован навсегда*\n\nIP \`${ip}\` заблокирован за попытку брутфорса.`,
          [
            [
              {
                text: '🔓 Разблокировать',
                callback_data: `admin_unblock:${ip}`,
              },
            ],
          ],
        );

        this.logger.log(`IP blocked for bruteforce: ${ip}`);
      }

      // Обработка отзыва токена
      else if (data.startsWith('admin_revoke:')) {
        const loginId = data.split(':')[1];

        // Получаем токен из запроса входа
        const loginRequest = await this.adminAuthService['prisma'].adminLoginRequest.findUnique({
          where: { loginId },
        });

        if (loginRequest?.token) {
          await this.adminAuthService.revokeToken(loginRequest.token);
        }

        await this.updateTelegramMessage(
          callback_query.message.chat.id,
          callback_query.message.message_id,
          '❌ *Токен отозван*\n\nПользователь разлогинен.',
          [],
        );

        this.logger.log(`Token revoked for login: ${loginId}`);
      }

      // Отвечаем Telegram что обработали callback
      await this.answerCallbackQuery(callback_query.id);
    } catch (error) {
      this.logger.error(`Error handling webhook: ${error.message}`);
      await this.answerCallbackQuery(
        callback_query.id,
        'Ошибка обработки запроса',
      );
    }

    return { ok: true };
  }

  /**
   * Обновить сообщение в Telegram
   */
  private async updateTelegramMessage(
    chatId: number,
    messageId: number,
    text: string,
    keyboard: any[][] = [],
  ) {
    if (!TELEGRAM_BOT_TOKEN) return;

    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'Markdown',
            reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
          }),
        },
      );
    } catch (error) {
      this.logger.error(`Failed to update message: ${error.message}`);
    }
  }

  /**
   * Ответить на callback query
   */
  private async answerCallbackQuery(callbackQueryId: string, text?: string) {
    if (!TELEGRAM_BOT_TOKEN) return;

    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: text || '✅ Готово',
          }),
        },
      );
    } catch (error) {
      this.logger.error(`Failed to answer callback: ${error.message}`);
    }
  }
}
