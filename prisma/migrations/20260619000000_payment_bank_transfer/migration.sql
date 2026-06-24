-- Добавить значение BANK_TRANSFER в enum PaymentMethod (оплата по реквизитам, только админка)
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
