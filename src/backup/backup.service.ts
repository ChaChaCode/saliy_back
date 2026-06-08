import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import { openAsBlob } from 'fs';
import { stat, unlink, readdir, mkdir } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

// Telegram ограничивает размер файла для ботов ~50 МБ. Берём с запасом.
const TG_MAX_BYTES = 49_000_000;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly dumpChatId = process.env.TELEGRAM_CHANNEL_ID_DUMP;
  private readonly backupDir = join(process.cwd(), 'backups');
  private readonly keepDays = 14;

  // Раз в 3 дня в 03:00 (как просил пользователь)
  @Cron('0 3 */3 * *', { name: 'db-backup' })
  async scheduledBackup() {
    this.logger.log('Запуск планового бэкапа БД...');
    await this.runBackup('scheduled');
  }

  /**
   * Создаёт дамп БД, ротирует старые копии и отправляет свежий в Telegram.
   * trigger — для подписи (scheduled / manual).
   */
  async runBackup(trigger: 'scheduled' | 'manual'): Promise<{ ok: boolean; file?: string; sizeMb?: number; error?: string }> {
    const db = this.parseDatabaseUrl();
    if (!db) {
      const msg = 'DATABASE_URL не распарсился — бэкап невозможен';
      this.logger.error(msg);
      await this.sendMessage(`❌ Бэкап saliy_db ПРОВАЛЕН: ${msg}`);
      return { ok: false, error: msg };
    }

    await mkdir(this.backupDir, { recursive: true });
    const stamp = this.timestamp();
    const file = join(this.backupDir, `saliy_db-${stamp}.sql.gz`);

    // pg_dump | gzip. Пароль передаём через PGPASSWORD в окружении дочернего процесса,
    // чтобы он не попал в строку команды (и в логи процессов).
    const cmd = `pg_dump -U ${db.user} -h ${db.host} -p ${db.port} ${db.name} | gzip > "${file}"`;
    try {
      await execAsync(cmd, { env: { ...process.env, PGPASSWORD: db.password }, shell: '/bin/bash' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`pg_dump упал: ${msg}`);
      await this.sendMessage(`❌ Бэкап saliy_db ПРОВАЛЕН (${trigger}): pg_dump упал`);
      return { ok: false, error: msg };
    }

    let sizeBytes: number;
    try {
      sizeBytes = (await stat(file)).size;
    } catch {
      await this.sendMessage(`❌ Бэкап saliy_db: файл не создан (${trigger})`);
      return { ok: false, error: 'dump file missing' };
    }

    if (sizeBytes === 0) {
      await unlink(file).catch(() => undefined);
      await this.sendMessage(`❌ Бэкап saliy_db: дамп пустой (0 байт, ${trigger})`);
      return { ok: false, error: 'empty dump' };
    }

    const sizeMb = Math.round(sizeBytes / 1024 / 1024);
    await this.rotateOldBackups();

    if (sizeBytes >= TG_MAX_BYTES) {
      this.logger.warn(`Бэкап ${sizeMb}MB больше лимита Telegram, оставлен локально: ${file}`);
      await this.sendMessage(`⚠️ Бэкап ${sizeMb}MB > лимита Telegram. Лежит локально на сервере: ${file}`);
      return { ok: true, file, sizeMb };
    }

    const sent = await this.sendDocument(file, `✅ Бэкап saliy_db ${stamp} (${sizeMb}MB) [${trigger}]`);
    if (!sent) {
      await this.sendMessage(`❌ Бэкап создан (${sizeMb}MB), но отправка файла в TG не удалась (${trigger}). Лежит локально.`);
      return { ok: false, file, sizeMb, error: 'telegram send failed' };
    }

    this.logger.log(`Бэкап отправлен в Telegram: ${file} (${sizeMb}MB)`);
    return { ok: true, file, sizeMb };
  }

  /** Удаляет локальные дампы старше keepDays дней. */
  private async rotateOldBackups() {
    try {
      const files = await readdir(this.backupDir);
      const cutoff = Date.now() - this.keepDays * 24 * 60 * 60 * 1000;
      for (const name of files) {
        if (!name.startsWith('saliy_db-') || !name.endsWith('.sql.gz')) continue;
        const full = join(this.backupDir, name);
        const info = await stat(full);
        if (info.mtimeMs < cutoff) {
          await unlink(full).catch(() => undefined);
          this.logger.log(`Удалён старый бэкап: ${name}`);
        }
      }
    } catch (e) {
      this.logger.warn(`Ротация бэкапов не удалась: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Разбирает DATABASE_URL вида postgresql://user:pass@host:port/db[?params]. */
  private parseDatabaseUrl() {
    const raw = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '');
    try {
      const u = new URL(raw);
      return {
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        host: u.hostname,
        port: u.port || '5432',
        name: u.pathname.replace(/^\//, '').split('?')[0],
      };
    } catch {
      return null;
    }
  }

  private async sendMessage(text: string): Promise<void> {
    if (!this.botToken || !this.dumpChatId) {
      this.logger.warn('TELEGRAM_BOT_TOKEN или TELEGRAM_CHANNEL_ID_DUMP не заданы — пропускаю отправку сообщения');
      return;
    }
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this.dumpChatId, text }),
      });
    } catch (e) {
      this.logger.error(`Не удалось отправить сообщение в Telegram: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async sendDocument(filePath: string, caption: string): Promise<boolean> {
    if (!this.botToken || !this.dumpChatId) {
      this.logger.warn('TELEGRAM_BOT_TOKEN или TELEGRAM_CHANNEL_ID_DUMP не заданы — пропускаю отправку файла');
      return false;
    }
    try {
      const form = new FormData();
      form.append('chat_id', this.dumpChatId);
      form.append('caption', caption);
      const blob = await openAsBlob(filePath, { type: 'application/gzip' });
      form.append('document', blob, filePath.split('/').pop() || 'backup.sql.gz');

      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendDocument`, {
        method: 'POST',
        body: form,
      });
      return res.ok;
    } catch (e) {
      this.logger.error(`Не удалось отправить файл в Telegram: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  private timestamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }
}
