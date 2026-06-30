import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Включить long-polling вместо webhook. На РФ-хостинге входящие webhook от
// Telegram таймаутят (маршрут Telegram→сервер режется), а исходящие getUpdates
// работают быстро — поэтому polling надёжнее. По умолчанию выключен.
const USE_POLLING = process.env.TELEGRAM_USE_POLLING === 'true';

/**
 * Long-polling Telegram: бэк сам опрашивает getUpdates и передаёт апдейты в
 * общий обработчик TelegramWebhookController.processUpdate. Запускается только
 * при TELEGRAM_USE_POLLING=true. При старте снимает webhook (они взаимоисключающи).
 */
@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private offset = 0;
  private running = false;

  constructor(private readonly webhookController: TelegramWebhookController) {}

  async onModuleInit() {
    if (!USE_POLLING) {
      return;
    }
    if (!TELEGRAM_BOT_TOKEN) {
      this.logger.warn('TELEGRAM_USE_POLLING=true, но TELEGRAM_BOT_TOKEN не задан — polling не запущен');
      return;
    }

    // Webhook и polling нельзя одновременно — снимаем webhook.
    await this.deleteWebhook();

    this.running = true;
    this.logger.log('Telegram long-polling запущен');
    void this.pollLoop();
  }

  onModuleDestroy() {
    this.running = false;
  }

  private async deleteWebhook() {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook?drop_pending_updates=false`,
      );
      const data = await res.json();
      this.logger.log(`deleteWebhook: ${JSON.stringify(data)}`);
    } catch (e) {
      this.logger.error(
        `Не удалось снять webhook: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async pollLoop() {
    while (this.running) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          // offset двигаем сразу, чтобы повторно не получить тот же апдейт,
          // даже если обработка упадёт.
          this.offset = update.update_id + 1;
          try {
            await this.webhookController.processUpdate(update);
          } catch (e) {
            this.logger.error(
              `Ошибка обработки update ${update.update_id}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      } catch (e) {
        // Сетевая ошибка/таймаут getUpdates — пауза и повтор, не роняем цикл.
        this.logger.error(
          `Ошибка getUpdates: ${e instanceof Error ? e.message : String(e)}`,
        );
        await this.sleep(3000);
      }
    }
  }

  /**
   * Long-poll getUpdates с timeout=30 (Telegram держит соединение до 30с, если
   * нет апдейтов). allowed_updates повторяет то, что было в webhook.
   */
  private async getUpdates(): Promise<any[]> {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: this.offset,
          timeout: 30,
          allowed_updates: ['message', 'channel_post', 'callback_query'],
        }),
      },
    );
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`getUpdates вернул ошибку: ${JSON.stringify(data)}`);
    }
    return data.result ?? [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
