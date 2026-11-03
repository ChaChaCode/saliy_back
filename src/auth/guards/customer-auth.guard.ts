import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { attachBetterAuthUser } from './better-auth-session';

/** Маршрут только для вошедшего покупателя (сессия Better Auth). */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly moduleRef: ModuleRef) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (await attachBetterAuthUser(context, this.moduleRef)) return true;
    throw new UnauthorizedException();
  }
}
