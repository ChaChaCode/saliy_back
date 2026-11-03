import { Injectable, ExecutionContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { attachBetterAuthUser } from './better-auth-session';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Сначала сессия Better Auth, затем прежний JWT (на время перехода витрины).
    if (await attachBetterAuthUser(context, this.moduleRef)) return true;
    return super.canActivate(context) as Promise<boolean>;
  }
}
