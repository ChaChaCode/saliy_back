import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Простой in-memory кеш с поддержкой TTL
 * Для production рекомендуется использовать Redis
 */
@Injectable()
export class SimpleCacheService {
  private readonly logger = new Logger(SimpleCacheService.name);
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Очищаем истёкшие записи каждые 60 секунд
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Сохранить значение в кеш
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
    this.logger.debug(`Cache set: ${key}, TTL: ${ttlMs}ms`);
  }

  /**
   * Получить значение из кеша
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Проверяем истекло ли значение
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired: ${key}`);
      return null;
    }

    return entry.value;
  }

  /**
   * Проверить существует ли ключ
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Удалить значение
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`Cache deleted: ${key}`);
  }

  /**
   * Очистить весь кеш
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Очистка истёкших записей
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Остановить сервис
   */
  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}
