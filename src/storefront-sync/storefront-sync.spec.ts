import { of, throwError } from 'rxjs';
import {
  StorefrontChanges,
  StorefrontSyncInterceptor,
} from './storefront-sync.module';
import { Controller, INestApplication, Patch } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StorefrontSyncModule } from './storefront-sync.module';

@Controller('admin/products')
class TestProductController {
  @Patch('test')
  update() {
    return { success: true };
  }
}

describe('Storefront invalidation', () => {
  const context = (method: string, originalUrl: string) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ method, originalUrl }) }),
    }) as any;

  it('notifies subscribers after a successful admin write, not a failed write', () => {
    const changes = new StorefrontChanges();
    const listener = jest.fn();
    changes.on('change', listener);
    const interceptor = new StorefrontSyncInterceptor(changes);
    interceptor
      .intercept(context('DELETE', '/api/admin/products/6'), {
        handle: () => of({ archived: true }),
      })
      .subscribe();
    interceptor
      .intercept(context('PATCH', '/api/admin/banners/1'), {
        handle: () => throwError(() => new Error('failed')),
      })
      .subscribe({ error: () => {} });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores reads, logins and cart writes, and supports public product writes', () => {
    const changes = new StorefrontChanges();
    const listener = jest.fn();
    changes.on('change', listener);
    const interceptor = new StorefrontSyncInterceptor(changes);
    for (const [method, path] of [
      ['GET', '/api/admin/products'],
      ['POST', '/api/admin/auth/login'],
      ['POST', '/api/cart'],
      ['PATCH', '/api/products/6'],
    ]) {
      interceptor
        .intercept(context(method, path), { handle: () => of({}) })
        .subscribe();
    }
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('Storefront change stream', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [StorefrontSyncModule],
      controllers: [TestProductController],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app.close();
  });

  it('streams a successful mutation and removes the listener after disconnect', async () => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 5000);
    const base = await app.getUrl();
    try {
      const response = await fetch(base + '/api/storefront/changes', {
        signal: abort.signal,
      });
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream',
      );
      expect(response.headers.get('x-accel-buffering')).toBe('no');
      const reader = response.body!.getReader();
      await reader.read(); // initial retry frame
      const mutation = await fetch(base + '/api/admin/products/test', {
        method: 'PATCH',
      });
      expect(mutation.ok).toBe(true);
      await mutation.text();
      const frame = await reader.read();
      expect(new TextDecoder().decode(frame.value)).toContain('event: change');
      await reader.cancel();
      abort.abort();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(app.get(StorefrontChanges).listenerCount('change')).toBe(0);
    } finally {
      clearTimeout(timeout);
      abort.abort();
    }
  });
});
