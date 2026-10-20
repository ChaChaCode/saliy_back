import sharp from 'sharp';

/**
 * Пресеты оптимизации изображений перед загрузкой в S3.
 * maxSize — ограничение по длинной стороне (меньшие картинки не увеличиваются).
 */
export const IMAGE_PRESETS = {
  product: { maxSize: 2000, quality: 82 },
  bannerDesktop: { maxSize: 2560, quality: 82 },
  bannerMobile: { maxSize: 1440, quality: 82 },
  review: { maxSize: 1600, quality: 80 },
  avatar: { maxSize: 512, quality: 80 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export interface OptimizedImage {
  buffer: Buffer;
  contentType: 'image/webp';
  ext: 'webp';
  width: number;
  height: number;
}

/**
 * Сжать изображение в WebP:
 *   - поворот по EXIF-ориентации (фото с телефона не ложатся набок);
 *   - уменьшение до maxSize по длинной стороне;
 *   - удаление метаданных (EXIF, GPS), перевод в sRGB.
 * Бросает ошибку, если буфер не является корректным изображением.
 */
export async function optimizeImage(
  input: Buffer,
  preset: ImagePreset,
): Promise<OptimizedImage> {
  const { maxSize, quality } = IMAGE_PRESETS[preset];

  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: 'image/webp',
    ext: 'webp',
    width: info.width,
    height: info.height,
  };
}
