-- Предзаказ продаётся из обычного stock («M — 100» = 100 штук под предзаказ).
-- Отдельный лимит preorder_stock больше не нужен; на 08.11.2026 он пуст у всех товаров.
ALTER TABLE "products" DROP COLUMN "preorder_stock";
