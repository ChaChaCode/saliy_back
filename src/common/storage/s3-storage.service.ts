import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private client!: S3Client;
  private bucket!: string;
  private publicBaseUrl!: string;

  onModuleInit() {
    const endpoint = process.env.YANDEX_ENDPOINT || 'https://storage.yandexcloud.net';
    const region = process.env.YANDEX_REGION || 'ru-central1';
    const accessKeyId = process.env.YANDEX_ACCESS_KEY;
    const secretAccessKey = process.env.YANDEX_SECRET_KEY;
    this.bucket = process.env.YANDEX_BUCKET || 'saliy-shop';
    this.publicBaseUrl = `${endpoint.replace(/\/+$/, '')}/${this.bucket}`;

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'YANDEX_ACCESS_KEY/YANDEX_SECRET_KEY не заданы — S3 загрузки работать не будут',
      );
    }

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      forcePathStyle: true, // для Yandex Cloud Object Storage
    });
  }

  /**
   * Загрузить файл в S3.
   * @param key ключ объекта (например, "banners/desktop-uuid-timestamp.jpg")
   * @returns тот же key — для сохранения в БД
   */
  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`Загружено в S3: ${key}`);
    return key;
  }

  /**
   * Собрать публичный URL из S3-ключа.
   * Пригодится там, где ключи лежат в массивах (не все попадают в S3UrlInterceptor).
   */
  keyToUrl(key: string): string {
    if (!key) return key;
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    const clean = key.replace(/^\/+/, '').replace(/^uploads\//, '');
    return `${this.publicBaseUrl}/${clean}`;
  }

  /**
   * Срезать публичный префикс/ведущие слэши, вернуть «голое» значение для сравнения/матчинга.
   * В отличие от normalizeKey — НЕ отсекает унаследованный "uploads/" (нужно для поиска
   * таких записей в product.images при ручном удалении).
   */
  extractKey(input: string | null | undefined): string {
    if (!input) return '';
    let value = input.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
      if (value.startsWith(this.publicBaseUrl)) {
        value = value.slice(this.publicBaseUrl.length);
      } else {
        try {
          const u = new URL(value);
          value = u.pathname;
        } catch {
          // игнорируем парс-ошибки
        }
      }
    }
    return value.replace(/^\/+/, '');
  }

  /**
   * Удалить объект из S3. Отсутствующий объект — не ошибка.
   * Принимает либо голый key ("banners/foo.jpg"), либо полный URL —
   * отсекает префикс bucket'а и `/uploads/` (унаследованные записи).
   */
  async delete(keyOrUrl: string | null | undefined): Promise<void> {
    if (!keyOrUrl) return;
    const key = this.normalizeKey(keyOrUrl);
    if (!key) return;

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`Удалено из S3: ${key}`);
    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404 || error?.Code === 'NoSuchKey') {
        return;
      }
      this.logger.warn(`Не удалось удалить S3-объект ${key}: ${error.message}`);
    }
  }

  /**
   * Превратить любой из форматов ({public-url}/{key}, /uploads/..., голый key)
   * в нормальный S3-ключ. Пустой результат → ничего не удаляем.
   */
  private normalizeKey(input: string): string | null {
    let value = input.trim();
    if (!value) return null;

    // Отрезаем публичный префикс бакета, если есть
    if (value.startsWith(this.publicBaseUrl)) {
      value = value.slice(this.publicBaseUrl.length);
    }
    // Отрезаем ведущие слэши
    value = value.replace(/^\/+/, '');
    // Унаследованные записи "/uploads/..." — ключа в S3 c таким префиксом нет
    if (value.startsWith('uploads/')) {
      return null;
    }
    return value || null;
  }
}
