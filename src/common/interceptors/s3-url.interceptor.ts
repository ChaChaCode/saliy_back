import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const S3_BASE_URL = 'https://storage.yandexcloud.net/saliy-shop';

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
      const transformed: any = {};

      for (const key in data) {
        const value = data[key];

        // Преобразуем URL-поля
        if (this.isUrlField(key) && typeof value === 'string') {
          transformed[key] = this.addBaseUrl(value);
        }
        // Рекурсивно обрабатываем вложенные объекты
        else if (typeof value === 'object' && value !== null) {
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
      key === 'sizeChart' ||
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

    // Добавляем базовый URL
    return `${S3_BASE_URL}/${url}`;
  }
}
