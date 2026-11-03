-- Прежний вход покупателей (JWT + свои коды) заменён Better Auth (auth_*).
-- Действующие старые сессии сбрасываются: покупатели входят по коду заново.

-- DropForeignKey
ALTER TABLE "VerificationCode" DROP CONSTRAINT "VerificationCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropTable
DROP TABLE "VerificationCode";

-- DropTable
DROP TABLE "RefreshToken";

