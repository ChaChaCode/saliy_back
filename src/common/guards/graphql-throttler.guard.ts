import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();

    // Если это GraphQL контекст, возвращаем req и res из context
    if (ctx && ctx.req && ctx.res) {
      return { req: ctx.req, res: ctx.res };
    }

    // Иначе используем стандартный HTTP контекст
    return super.getRequestResponse(context);
  }
}
