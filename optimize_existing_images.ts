/**
 * Пережать уже загруженные в S3 фото (товары — JPEG, остальное — WebP)
 * и переписать ссылки в БД на новые ключи.
 *
 * По умолчанию — пробный прогон: скачивает и сжимает, показывает экономию,
 * ничего не пишет. С флагом --apply загружает сжатые копии (*-opt.jpg / *-opt.webp) и обновляет БД.
 * Оригиналы в S3 НЕ удаляются — их можно удалить вручную после проверки сайта.
 * В режиме --apply каждое изменение ссылки пишется в optimize_images_backup_*.jsonl
 * (таблица, id, поле, старое и новое значение) — по нему можно откатить.
 *
 * Запуск: npx ts-node --transpile-only optimize_existing_images.ts [--apply]
 */
import 'dotenv/config';
import { appendFileSync } from 'fs';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  ImagePreset,
  optimizeImage,
} from './src/common/storage/image-optimizer';

const APPLY = process.argv.includes('--apply');
// Меньшая экономия не стоит повторного сжатия с потерями
const MIN_SAVING = 0.1;
const BACKUP_FILE = `optimize_images_backup_${Date.now()}.jsonl`;

/** Записать изменение в бэкап до того, как оно попадёт в БД. */
function backup(
  table: string,
  id: string | number,
  field: string,
  old: unknown,
  next: unknown,
) {
  appendFileSync(
    BACKUP_FILE,
    JSON.stringify({ table, id, field, old, new: next }) + '\n',
  );
}

const endpoint =
  process.env.YANDEX_ENDPOINT || 'https://storage.yandexcloud.net';
const bucket = process.env.YANDEX_BUCKET || 'saliy-shop';
const publicBaseUrl = `${endpoint.replace(/\/+$/, '')}/${bucket}`;

const s3 = new S3Client({
  endpoint,
  region: process.env.YANDEX_REGION || 'ru-central1',
  credentials: {
    accessKeyId: process.env.YANDEX_ACCESS_KEY || '',
    secretAccessKey: process.env.YANDEX_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

const stats = { converted: 0, skipped: 0, failed: 0, before: 0, after: 0 };
// старый ключ → новый (или null, если оставляем как есть) — одно фото может встречаться дважды
const done = new Map<string, string | null>();

/** Полный URL / голый ключ → ключ S3. null — легаси /uploads/ (в S3 таких нет). */
function toKey(value: string): string | null {
  let v = value.trim();
  if (v.startsWith(publicBaseUrl)) {
    v = v.slice(publicBaseUrl.length);
  } else if (v.startsWith('http://') || v.startsWith('https://')) {
    return null; // чужой хост — не трогаем
  }
  v = v.replace(/^\/+/, '');
  if (!v || v.startsWith('uploads/')) return null;
  return v;
}

/** Сжать одно фото. Возвращает новый ключ или null, если фото оставляем. */
async function convert(
  value: string,
  preset: ImagePreset,
): Promise<string | null> {
  const key = toKey(value);
  // *-opt.<ext> — результат прошлого запуска скрипта
  if (!key || /-opt\.[a-z0-9]+$/i.test(key)) return null;
  if (done.has(key)) return done.get(key)!;

  let result: string | null = null;
  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const original = Buffer.from(await obj.Body!.transformToByteArray());
    const optimized = await optimizeImage(original, preset);

    if (optimized.buffer.length > original.length * (1 - MIN_SAVING)) {
      console.log(`  = ${key}: уже оптимально (${kb(original.length)})`);
      stats.skipped++;
    } else {
      // Суффикс -opt: формат может совпасть с исходным (jpg → jpg), а оригинал не трогаем
      const newKey = `${key.replace(/\.[^./]+$/, '')}-opt.${optimized.ext}`;
      if (APPLY) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: newKey,
            Body: optimized.buffer,
            ContentType: optimized.contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
      }
      console.log(
        `  ✓ ${key}: ${kb(original.length)} → ${kb(optimized.buffer.length)} (${optimized.width}x${optimized.height})`,
      );
      stats.converted++;
      stats.before += original.length;
      stats.after += optimized.buffer.length;
      result = newKey;
    }
  } catch (error: any) {
    console.warn(`  ✗ ${key}: ${error.message}`);
    stats.failed++;
  }

  done.set(key, result);
  return result;
}

async function products() {
  console.log('\n📦 Товары');
  const list = await prisma.product.findMany({
    select: { id: true, images: true },
  });
  for (const p of list) {
    if (!Array.isArray(p.images)) continue;
    let changed = false;
    const images: any[] = [];
    for (const img of p.images as any[]) {
      const newKey = img?.url ? await convert(img.url, 'product') : null;
      if (newKey) changed = true;
      images.push(newKey ? { ...img, url: newKey } : img);
    }
    if (changed && APPLY) {
      backup('product', p.id, 'images', p.images, images);
      await prisma.product.update({
        where: { id: p.id },
        data: { images: images as Prisma.InputJsonValue },
      });
    }
  }
}

async function banners() {
  console.log('\n🖼  Баннеры');
  const list = await prisma.banner.findMany({
    select: { id: true, desktopImageUrl: true, mobileImageUrl: true },
  });
  for (const b of list) {
    const desktop = await convert(b.desktopImageUrl, 'bannerDesktop');
    const mobile = await convert(b.mobileImageUrl, 'bannerMobile');
    if ((desktop || mobile) && APPLY) {
      if (desktop)
        backup('banner', b.id, 'desktopImageUrl', b.desktopImageUrl, desktop);
      if (mobile)
        backup('banner', b.id, 'mobileImageUrl', b.mobileImageUrl, mobile);
      await prisma.banner.update({
        where: { id: b.id },
        data: {
          ...(desktop && { desktopImageUrl: desktop }),
          ...(mobile && { mobileImageUrl: mobile }),
        },
      });
    }
  }
}

async function reviews() {
  console.log('\n💬 Отзывы');
  const list = await prisma.review.findMany({
    select: { id: true, images: true },
  });
  for (const r of list) {
    if (!Array.isArray(r.images) || r.images.length === 0) continue;
    let changed = false;
    const images: string[] = [];
    for (const k of r.images as string[]) {
      const newKey = typeof k === 'string' ? await convert(k, 'review') : null;
      if (newKey) changed = true;
      images.push(newKey ?? k);
    }
    if (changed && APPLY) {
      backup('review', r.id, 'images', r.images, images);
      await prisma.review.update({
        where: { id: r.id },
        data: { images: images as Prisma.InputJsonValue },
      });
    }
  }
}

async function avatars() {
  console.log('\n👤 Аватары');
  const list = await prisma.user.findMany({
    where: { avatarUrl: { not: null } },
    select: { id: true, avatarUrl: true },
  });
  for (const u of list) {
    const newKey = await convert(u.avatarUrl!, 'avatar');
    if (newKey && APPLY) {
      backup('user', u.id, 'avatarUrl', u.avatarUrl, newKey);
      await prisma.user.update({
        where: { id: u.id },
        data: { avatarUrl: newKey },
      });
    }
  }
}

async function main() {
  console.log(
    APPLY
      ? '🚀 Режим --apply: загружаю и обновляю БД'
      : '🔍 Пробный прогон (без изменений). Для записи: --apply',
  );
  await products();
  await banners();
  await reviews();
  await avatars();

  const saved = stats.before - stats.after;
  console.log('\n' + '='.repeat(50));
  console.log(
    `Сжато: ${stats.converted}, оставлено как есть: ${stats.skipped}, ошибок: ${stats.failed}`,
  );
  console.log(
    `Объём: ${kb(stats.before)} → ${kb(stats.after)} (−${kb(saved)})`,
  );
  if (!APPLY) console.log('Ничего не изменено. Запустите с --apply.');
  else if (stats.converted > 0)
    console.log(`Бэкап старых ссылок: ${BACKUP_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
