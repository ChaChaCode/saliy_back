import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { attachBetterAuthUser } from './better-auth-session';

/**
 * Маршрут для гостей и покупателей: если есть сессия Better Auth, кладёт
 * профиль в req.user, иначе пропускает без него.
 */
@Injectable()
export class OptionalCustomerAuthGuard implements CanActivate {
  constructor(private readonly moduleRef: ModuleRef) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await attachBetterAuthUser(context, this.moduleRef);
    return true;
  }
}
