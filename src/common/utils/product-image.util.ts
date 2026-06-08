/**
 * Утилита выбора главного фото товара из массива images.
 *
 * Структура каждого изображения (JSON-поле Product.images):
 *   { url: string, order?: number, isPreview: boolean, previewOrder: number }
 *
 * Старые записи в БД могут не иметь поля `order` — это учтено: фолбэк по индексу.
 *
 * Правила выбора главного фото:
 *   1. фото с previewOrder === 1 (primary);
 *   2. иначе первое с isPreview === true;
 *   3. иначе первое по наименьшему order (старые без order — по индексу массива);
 *   4. иначе images[0].
 */
export interface ProductImageLike {
  url: string;
  order?: number;
  isPreview?: boolean;
  previewOrder?: number;
}

/**
 * Вернуть объект главного изображения (или null, если массив пуст/невалиден).
 */
export function pickMainImage<T extends ProductImageLike>(
  images: unknown,
): T | null {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }
  const arr = images as T[];

  const primary = arr.find((img) => Number(img?.previewOrder) === 1);
  if (primary) return primary;

  const preview = arr.find((img) => img?.isPreview === true);
  if (preview) return preview;

  // Сортируем по order (отсутствующий order трактуем как индекс/Infinity),
  // не мутируя исходный массив.
  const withIndex = arr.map((img, idx) => ({ img, idx }));
  withIndex.sort((a, b) => {
    const ao = typeof a.img?.order === 'number' ? a.img.order : a.idx;
    const bo = typeof b.img?.order === 'number' ? b.img.order : b.idx;
    return ao - bo;
  });
  return withIndex[0]?.img ?? arr[0];
}

/**
 * Вернуть url главного изображения (или null).
 */
export function pickMainImageUrl(images: unknown): string | null {
  return pickMainImage(images)?.url ?? null;
}
