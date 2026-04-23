import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const S3_BASE_URL = (
  `${process.env.YANDEX_ENDPOINT || 'https://storage.yandexcloud.net'}/${process.env.YANDEX_BUCKET || 'saliy-shop'}`
).replace(/\/+$/, '');

/**
 * Преобразует относительные пути в полные S3 URL
 */
@Injectable()
export class S3UrlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => this.transformUrls(data)),
    );
  }

  private transformUrls(data: any): any {
    if (!data) return data;

    // Если это массив
    if (Array.isArray(data)) {
      return data.map((item) => this.transformUrls(item));
    }

    // Если это объект
    if (typeof data === 'object') {
      // Пропускаем Date объекты - не трансформируем их
      if (data instanceof Date) {
        return data;
      }

      const transformed: any = {};

      for (const key in data) {
        const value = data[key];

        // Преобразуем URL-поля
        if (this.isUrlField(key) && typeof value === 'string') {
          transformed[key] = this.addBaseUrl(value);
        }
        // Рекурсивно обрабатываем вложенные объекты (но не Date)
        else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
          transformed[key] = this.transformUrls(value);
        }
        // Остальные поля оставляем как есть
        else {
          transformed[key] = value;
        }
      }

      return transformed;
    }

    return data;
  }

  private isUrlField(key: string): boolean {
    return (
      key === 'url' ||
      key.endsWith('Url') ||
      key.endsWith('ImageUrl') ||
      key.endsWith('BannerUrl')
    );
  }

  private addBaseUrl(url: string): string {
    // Если уже полный URL, возвращаем как есть
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Срезаем ведущие слэши и устаревший префикс "/uploads/"
    const key = url
      .replace(/^\/+/, '')
      .replace(/^uploads\//, '');

    return `${S3_BASE_URL}/${key}`;
  }
}
