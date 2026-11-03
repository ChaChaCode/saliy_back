-- Отметка об отправке письма подписчикам о товаре: защита от повторной рассылки.
ALTER TABLE "products" ADD COLUMN "newsletter_sent_at" TIMESTAMP(3);
