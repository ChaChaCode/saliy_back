-- Сумма возвращённых покупателю денег (полный и частичные возвраты).
ALTER TABLE "orders" ADD COLUMN "refunded_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Заказы, уже отмеченные как возвращённые, считаем возвращёнными полностью.
UPDATE "orders" SET "refunded_amount" = "total" WHERE "status" = 'REFUNDED';
