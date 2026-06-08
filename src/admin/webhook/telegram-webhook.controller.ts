import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuthService } from '../auth/admin-auth.service';
import { SimpleCacheService } from '../../common/cache/simple-cache.service';
import { BackupService } from '../../backup/backup.service';

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
  // message — личка/группы, channel_post — посты в канале. Оба несут text.
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
  channel_post?: {
    message_id: number;
    chat: {
      id: number;
    };
    text?: string;
  };
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
// Чаты, которым разрешена команда /dump (секретный канал админки и канал дампов).
const DUMP_ALLOWED_CHAT_IDS = [
  process.env.TELEGRAM_CHANNEL_ID,
  process.env.TELEGRAM_CHANNEL_ID_DUMP,
].filter(Boolean);

@Controller('admin/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private adminAuthService: AdminAuthService,
    private cacheService: SimpleCacheService,
    private backupService: BackupService,
  ) {}

  /**
   * Webhook для обработки callback из Telegram
   * POST /admin/telegram/webhook
   */
  @Post('webhook')
  async handleWebhook(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    // Проверяем, что запрос действительно от Telegram.
    // Telegram присылает заголовок X-Telegram-Bot-Api-Secret-Token, заданный
    // при setWebhook. Без этой проверки кто угодно мог бы подделать callback
    // и, например, подтвердить вход и создать себе SUPER_ADMIN.
    if (!TELEGRAM_WEBHOOK_SECRET || secretToken !== TELEGRAM_WEBHOOK_SECRET) {
      this.logger.warn('Отклонён webhook с неверным secret token');
      throw new UnauthorizedException('Invalid webhook secret');
    }

    this.logger.log(`Received Telegram update: ${JSON.stringify(update)}`);

    // Обработка текстовых команд боту (например /dump).
    // Сообщения из канала приходят как channel_post, из лички/групп — как message.
    const textMessage = update.message ?? update.channel_post;
    if (textMessage?.text) {
      await this.handleCommand(textMessage);
      return { ok: true };
    }

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
   * Обработка текстовых команд боту.
   * Команда /dump запускает ручной бэкап БД — доступна только из разрешённых
   * чатов (секретный канал админки / канал дампов), чтобы посторонний не мог
   * выгрузить базу.
   */
  private async handleCommand(message: {
    chat: { id: number };
    text?: string;
  }) {
    const text = (message.text || '').trim();
    const command = text.split(/\s+/)[0].split('@')[0]; // /dump@bot -> /dump
    const chatId = String(message.chat.id);

    if (command !== '/dump') {
      return; // прочие команды игнорируем
    }

    // Авторизация: команда только из разрешённых чатов
    if (!DUMP_ALLOWED_CHAT_IDS.includes(chatId)) {
      this.logger.warn(`Команда /dump отклонена из чата ${chatId} (не в списке)`);
      await this.sendMessage(message.chat.id, '⛔ Команда недоступна в этом чате.');
      return;
    }

    await this.sendMessage(message.chat.id, '⏳ Делаю бэкап БД...');
    try {
      const result = await this.backupService.runBackup('manual');
      if (!result.ok) {
        await this.sendMessage(
          message.chat.id,
          `❌ Бэкап не удался: ${result.error || 'неизвестная ошибка'}`,
        );
      }
      // При успехе BackupService сам отправит файл в канал дампов с подписью.
    } catch (e) {
      this.logger.error(`Ошибка ручного бэкапа: ${e instanceof Error ? e.message : String(e)}`);
      await this.sendMessage(message.chat.id, '❌ Ошибка при выполнении бэкапа.');
    }
  }

  /**
   * Отправить простое сообщение в чат.
   */
  private async sendMessage(chatId: number, text: string) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (e) {
      this.logger.error(`Не удалось отправить сообщение: ${e instanceof Error ? e.message : String(e)}`);
    }
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
