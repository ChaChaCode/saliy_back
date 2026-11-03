import { ExecutionContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthService as BetterAuthService } from '@thallesp/nestjs-better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthService } from '../auth.service';

/**
 * Если есть действующая сессия Better Auth — кладёт в req.user полный профиль
 * покупателя (тот же, что отдаёт /api/auth/me) и возвращает true, иначе false.
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
