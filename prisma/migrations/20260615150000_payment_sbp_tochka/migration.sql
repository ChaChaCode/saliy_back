-- Добавить значение SBP_TOCHKA в enum PaymentMethod
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SBP_TOCHKA';
