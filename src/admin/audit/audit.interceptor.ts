import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

/**
 * Автоматически логирует все state-changing запросы админа (POST/PUT/PATCH/DELETE).
 * GET-запросы не логируются, чтобы не засорять БД.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    // Интерцептор работает только для HTTP запросов, не для GraphQL/WS
    if (ctx.getType() !== 'http') {
      return next.handle();
    }

    const request = ctx.switchToHttp().getRequest();
    const response = ctx.switchToHttp().getResponse();

    if (!request) {
      return next.handle();
    }

    const method: string = request.method;
    const path: string = request.originalUrl || request.url;

    // Не логируем GET и не-админские маршруты
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isAdminRoute = path.includes('/admin/');
    if (!isMutation || !isAdminRoute) {
      return next.handle();
    }

    // Пропускаем auth и webhook (иначе будет логировать входы)
    if (path.includes('/admin/auth') || path.includes('/admin/webhook')) {
      return next.handle();
    }

    const admin = request.admin;
    const ip =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.ip ||
      'unknown';
    const userAgent = request.headers['user-agent'] || '';

    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    // Извлекаем entityType из пути: /api/admin/orders/SALIY... -> orders
    const entityType = this.extractEntityType(path);
    const entityId = this.extractEntityId(path);

    // Body — безопасно (масhируем пароли/токены)
    const body = this.sanitizeBody(request.body);

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService.create({
            adminId: admin?.id,
            adminName: admin?.name,
            action: actionMap[method] || 'CUSTOM',
            method,
            path,
            entityType,
            entityId,
            changes: body,
            ip,
            userAgent,
            statusCode: response.statusCode,
          });
        },
        error: (err) => {
          this.auditService.create({
            adminId: admin?.id,
            adminName: admin?.name,
            action: actionMap[method] || 'CUSTOM',
            method,
            path,
            entityType,
            entityId,
            changes: body,
            ip,
            userAgent,
            statusCode: err?.status || 500,
          });
        },
      }),
    );
  }

  private extractEntityType(path: string): string | undefined {
    // /api/admin/orders/SALIY... -> orders
    // /api/admin/products/123 -> products
    const match = path.match(/\/admin\/([^/?]+)/);
    return match?.[1];
  }

  private extractEntityId(path: string): string | undefined {
    // Последний сегмент пути — часто ID
    const cleanPath = path.split('?')[0];
    const parts = cleanPath.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    // Не возвращаем если это просто имя коллекции
    if (!last || last === 'admin') return undefined;
    return last;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const clone = { ...body };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'refreshToken'];
    for (const key of sensitiveKeys) {
      if (key in clone) clone[key] = '***';
    }
    return clone;
  }
}
