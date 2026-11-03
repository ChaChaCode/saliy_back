import { ExecutionContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthService } from '../auth.service';

/**
 * Пока витрина переходит на Better Auth, защищённые маршруты принимают и
 * сессию Better Auth, и прежний JWT в куке. Если есть действующая сессия
 * Better Auth — кладёт в req.user тот же профиль, что и при входе по JWT,
 * и возвращает true. Иначе false: дальше проверяется JWT.
 */
export async function attachBetterAuthUser(
  context: ExecutionContext,
  moduleRef: ModuleRef,
): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const betterAuth = moduleRef.get(BetterAuthService, { strict: false });
  const session = await betterAuth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) return false;

  const user = await moduleRef
    .get(AuthService, { strict: false })
    .validateUser(session.user.id);
  if (!user) return false;

  request.user = user;
  return true;
}
