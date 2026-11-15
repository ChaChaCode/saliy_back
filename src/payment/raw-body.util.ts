import { PayloadTooLargeException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Тело запроса строкой. Глобальный разбор тела выключен (main.ts), а парсеры
 * JSON и форм из модуля Better Auth не трогают application/octet-stream, в
 * котором Яндекс Пэй присылает уведомления, — поэтому читаем поток сами.
 */
export function readRawBody(req: Request, limitBytes: number): Promise<string> {
  const body: unknown = req.body;
  if (typeof body === 'string') return Promise.resolve(body);
  if (Buffer.isBuffer(body)) return Promise.resolve(body.toString('utf8'));
  if (req.readableEnded) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new PayloadTooLargeException());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
