-- Счётчик неудачных попыток ввода кода подтверждения (защита от перебора).
ALTER TABLE "VerificationCode" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
