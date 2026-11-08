ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_PREORDER';
ALTER TABLE "orders" ADD COLUMN "inventory_released" BOOLEAN NOT NULL DEFAULT false;
UPDATE "orders" SET "inventory_released" = true WHERE "status"::text IN ('CANCELLED', 'PAYMENT_FAILED');
ALTER TABLE "products"
  ADD COLUMN "preorder_stock" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "order_items"
  ADD COLUMN "is_preorder" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preorder_ready" BOOLEAN NOT NULL DEFAULT false;
