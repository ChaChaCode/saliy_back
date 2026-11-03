import { Injectable, ExecutionContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { attachBetterAuthUser } from './better-auth-session';

/**
 * Guard который позволяет запросы и с токеном, и без токена
 * Если токен есть - валидирует и добавляет req.user
 * Если токена нет - пропускает запрос (req.user будет undefined)
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Сначала сессия Better Auth, затем прежний JWT (на время перехода витрины).
    if (await attachBetterAuthUser(context, this.moduleRef)) return true;
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err: any, user: any) {
    // Не выбрасываем ошибку, если пользователь не авторизован
    // Просто возвращаем user (который может быть null/undefined)
    return user;
  }
}
