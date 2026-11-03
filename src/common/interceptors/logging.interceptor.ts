import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    // Логирование HTTP запросов
    const http = context.switchToHttp();
    const request = http.getRequest();

    if (!request) {
      // Если нет HTTP request (например, для microservices), просто пропускаем
      return next.handle();
    }

    const { method, url, ip } = request;
    const userAgent = request.get?.('user-agent') || '';

    return next.handle().pipe(
      tap({
        next: () => {
          const response = http.getResponse();
          const { statusCode } = response;
          const responseTime = Date.now() - now;

          this.logger.log(
            `${method} ${url} ${statusCode} +${responseTime}ms - ${ip} ${userAgent}`,
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          // 4xx — ошибка запроса (гость без сессии, неверные данные), а не сбой
          // сервера: пишем предупреждением, чтобы в ERROR оставались только 5xx.
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          const line = `${method} ${url} ${status} +${responseTime}ms - ${error.message}`;
          if (status < 500) this.logger.warn(line);
          else this.logger.error(line);
        },
      }),
    );
  }
}
