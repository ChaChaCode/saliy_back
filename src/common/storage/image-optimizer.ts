import sharp from 'sharp';

/**
 * Пресеты оптимизации изображений перед загрузкой в S3.
 * maxSize — ограничение по длинной стороне (меньшие картинки не увеличиваются).
 */
export const IMAGE_PRESETS = {
  product: { maxSize: 2000 },
  bannerDesktop: { maxSize: 2560 },
  bannerMobile: { maxSize: 1440 },
  review: { maxSize: 1600 },
  avatar: { maxSize: 512 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/**
 * Основной формат — AVIF. effort 2: на сервере с 1 ядром кодирование ~1,5 с
 * на фото вместо ~8 с при effort 4, а вес больше всего на ~8%.
 */
const AVIF_OPTIONS = { quality: 85, effort: 2 };
/** Запасная копия для браузеров без AVIF (iOS 15 и старше): JPEG... */
const FALLBACK_JPEG_OPTIONS = { quality: 85, mozjpeg: true };
/** ...или WebP, если у фото есть прозрачность (JPEG её не держит). */
const FALLBACK_WEBP_OPTIONS = { quality: 90, effort: 5, smartSubsample: true };

/** Суффикс сжатых файлов: у каждого `<имя>-opt.jpg|webp` рядом лежит `<имя>-opt.avif`. */
export const OPTIMIZED_SUFFIX = '-opt';
const FALLBACK_KEY_RE = /-opt\.(jpg|webp)$/i;

/** Ключ AVIF-копии для запасного файла или null, если у файла её нет. */
export function avifSiblingKey(key: string): string | null {
  return FALLBACK_KEY_RE.test(key)
    ? key.replace(/\.(jpg|webp)$/i, '.avif')
    : null;
}

export interface EncodedImage {
  buffer: Buffer;
  contentType: 'image/avif' | 'image/jpeg' | 'image/webp';
  ext: 'avif' | 'jpg' | 'webp';
}

export interface OptimizedImage {
  avif: EncodedImage;
  fallback: EncodedImage;
  width: number;
  height: number;
}

/**
 * Сжать изображение в две копии — AVIF и запасную JPEG/WebP:
 *   - поворот по EXIF-ориентации (фото с телефона не ложатся набок);
 *   - уменьшение до maxSize по длинной стороне;
 *   - удаление метаданных (EXIF, GPS), перевод в sRGB.
 * Бросает ошибку, если буфер не является корректным изображением.
 */
export async function optimizeImage(
  input: Buffer,
  preset: ImagePreset,
): Promise<OptimizedImage> {
  const { maxSize } = IMAGE_PRESETS[preset];

  // Декодируем и уменьшаем один раз, оба формата кодируем из готовых пикселей
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const raw = () =>
    sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    });

  // Альфа-канал бывает и у полностью непрозрачных PNG — проверяем по факту
  const transparent = info.channels === 4 && !(await raw().stats()).isOpaque;

  // Непрозрачное — без альфа-канала, чтобы не тратить на него байты в AVIF
  const pixels = () =>
    transparent ? raw() : raw().flatten({ background: '#ffffff' });

  const [avif, fallback] = await Promise.all([
    pixels().avif(AVIF_OPTIONS).toBuffer(),
    transparent
      ? pixels().webp(FALLBACK_WEBP_OPTIONS).toBuffer()
      : pixels().jpeg(FALLBACK_JPEG_OPTIONS).toBuffer(),
  ]);

  return {
    avif: { buffer: avif, contentType: 'image/avif', ext: 'avif' },
    fallback: transparent
      ? { buffer: fallback, contentType: 'image/webp', ext: 'webp' }
      : { buffer: fallback, contentType: 'image/jpeg', ext: 'jpg' },
    width: info.width,
    height: info.height,
  };
}
