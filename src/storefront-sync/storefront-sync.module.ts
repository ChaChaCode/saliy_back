import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  NestInterceptor,
  Res,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SkipThrottle } from '@nestjs/throttler';
import { EventEmitter } from 'events';
import type { Response } from 'express';
import { tap } from 'rxjs';

@Injectable()
export class StorefrontChanges extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }

  publish() {
    this.emit('change');
  }
}

@Injectable()
export class StorefrontSyncInterceptor implements NestInterceptor {
  constructor(private readonly changes: StorefrontChanges) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      request.method,
    );
    const content =
      /^\/api\/(?:admin\/(?!auth(?:\/|$)|webhook(?:\/|$))|products(?:\/|$)|categories(?:\/|$)|reviews(?:\/|$))/.test(
        path,
      );
    if (!mutation || !content) return next.handle();
    return next.handle().pipe(tap(() => this.changes.publish()));
  }
}

@Controller('storefront')
export class StorefrontSyncController {
  constructor(private readonly changes: StorefrontChanges) {}

  @Get('changes')
  @SkipThrottle()
  subscribe(@Res() response: Response) {
    response.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    response.write('retry: 2000\n\n');
    const notify = () => response.write('event: change\ndata: {}\n\n');
    this.changes.on('change', notify);
    const heartbeat = setInterval(
      () => response.write(': heartbeat\n\n'),
      15000,
    );
    response.on('close', () => {
      clearInterval(heartbeat);
      this.changes.off('change', notify);
    });
  }
}

@Module({
  controllers: [StorefrontSyncController],
  providers: [
    StorefrontChanges,
    { provide: APP_INTERCEPTOR, useClass: StorefrontSyncInterceptor },
  ],
})
export class StorefrontSyncModule {}
