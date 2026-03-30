import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType<string>();

    // Логирование GraphQL запросов
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      const info = gqlContext.getInfo();
      const operationType = info.operation.operation;
      const operationName = info.fieldName;

      const now = Date.now();
      return next.handle().pipe(
        tap({
          next: () => {
            const responseTime = Date.now() - now;
            this.logger.log(
              `GraphQL ${operationType.toUpperCase()} ${operationName} +${responseTime}ms`,
            );
          },
          error: (error) => {
            const responseTime = Date.now() - now;
            this.logger.error(
              `GraphQL ${operationType.toUpperCase()} ${operationName} ERROR +${responseTime}ms - ${error.message}`,
            );
          },
        }),
      );
    }

    // Логирование HTTP запросов
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';

    const now = Date.now();
    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const responseTime = Date.now() - now;

          this.logger.log(
            `${method} ${url} ${statusCode} +${responseTime}ms - ${ip} ${userAgent}`,
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `${method} ${url} ERROR +${responseTime}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
