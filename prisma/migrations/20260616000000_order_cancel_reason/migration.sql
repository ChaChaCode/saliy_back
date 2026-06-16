-- Причина отмены/неоплаты заказа (для отображения в админке)
ALTER TABLE "orders" ADD COLUMN "cancel_reason" TEXT;
