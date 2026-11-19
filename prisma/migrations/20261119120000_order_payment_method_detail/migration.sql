-- Чем именно платили внутри способа оплаты (для Яндекс Пэй: CARD, SPLIT, SBP).
ALTER TABLE "orders" ADD COLUMN "payment_method_detail" TEXT;
