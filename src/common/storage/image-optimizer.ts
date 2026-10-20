import sharp from 'sharp';

/**
 * Пресеты оптимизации изображений перед загрузкой в S3.
 * maxSize — ограничение по длинной стороне (меньшие картинки не увеличиваются).
 *
 * Фото товаров — JPEG (mozjpeg): при том же весе он лучше WebP сохраняет
 * фактуру ткани, WebP её заметно размывает. Остальное — WebP.
 */
export const IMAGE_PRESETS = {
  product: { maxSize: 2000, format: 'jpeg', quality: 85 },
  bannerDesktop: { maxSize: 2560, format: 'webp', quality: 82 },
  bannerMobile: { maxSize: 1440, format: 'webp', quality: 82 },
  review: { maxSize: 1600, format: 'webp', quality: 80 },
  avatar: { maxSize: 512, format: 'webp', quality: 80 },
} as const;

/** Качество WebP для фото с прозрачностью, которые нельзя сохранить в JPEG. */
const ALPHA_WEBP_QUALITY = 90;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export interface OptimizedImage {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/webp';
  ext: 'jpg' | 'webp';
  width: number;
  height: number;
}

/**
 * Сжать изображение:
 *   - поворот по EXIF-ориентации (фото с телефона не ложатся набок);
 *   - уменьшение до maxSize по длинной стороне;
 *   - удаление метаданных (EXIF, GPS), перевод в sRGB;
 *   - JPEG или WebP по пресету; фото с прозрачностью — всегда WebP.
 * Бросает ошибку, если буфер не является корректным изображением.
 */
export async function optimizeImage(
  input: Buffer,
  preset: ImagePreset,
): Promise<OptimizedImage> {
  const { maxSize, format, quality } = IMAGE_PRESETS[preset];

  const pipeline = sharp(input, { failOn: 'error' }).rotate().resize({
    width: maxSize,
    height: maxSize,
    fit: 'inside',
    withoutEnlargement: true,
  });

  // Альфа-канал бывает и у полностью непрозрачных PNG — проверяем по факту
  let useJpeg = format === 'jpeg';
  if (useJpeg && (await sharp(input).metadata()).hasAlpha) {
    useJpeg = (await sharp(input).stats()).isOpaque;
  }

  const { data, info } = await (
    useJpeg
      ? pipeline
          .flatten({ background: '#ffffff' })
          .jpeg({ quality, mozjpeg: true })
      : pipeline.webp({
          quality: format === 'jpeg' ? ALPHA_WEBP_QUALITY : quality,
          effort: 5,
          smartSubsample: true,
        })
  ).toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: useJpeg ? 'image/jpeg' : 'image/webp',
    ext: useJpeg ? 'jpg' : 'webp',
    width: info.width,
    height: info.height,
  };
}
