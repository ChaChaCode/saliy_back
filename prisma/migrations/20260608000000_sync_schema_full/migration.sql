-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENTAGE', 'FIXED', 'FREE_DELIVERY');

-- CreateEnum
CREATE TYPE "PromoAppliesTo" AS ENUM ('ALL', 'PRODUCT');

-- AlterEnum
BEGIN;
CREATE TYPE "DeliveryType_new" AS ENUM ('CDEK_PICKUP', 'STANDARD');
ALTER TABLE "orders" ALTER COLUMN "delivery_type" TYPE "DeliveryType_new" USING ("delivery_type"::text::"DeliveryType_new");
ALTER TYPE "DeliveryType" RENAME TO "DeliveryType_old";
ALTER TYPE "DeliveryType_new" RENAME TO "DeliveryType";
DROP TYPE "public"."DeliveryType_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "birthdate" TIMESTAMP(3),
ADD COLUMN     "birthdate_updated_at" TIMESTAMP(3),
ADD COLUMN     "cdek_pickup_point_code" TEXT,
ADD COLUMN     "delivery_country_code" TEXT,
ADD COLUMN     "delivery_type" TEXT,
ADD COLUMN     "full_address" TEXT,
ADD COLUMN     "social_contact" TEXT;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "name_en",
DROP COLUMN "name_pl",
ADD COLUMN     "desktop_banner_url" TEXT,
ADD COLUMN     "mobile_banner_url" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "social_contact" TEXT;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "description_en",
DROP COLUMN "description_pl",
DROP COLUMN "name_en",
DROP COLUMN "name_pl",
DROP COLUMN "prices",
ADD COLUMN     "color" TEXT,
ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "images" SET DEFAULT '[]';

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_login_requests" (
    "id" TEXT NOT NULL,
    "login_id" TEXT NOT NULL,
    "verification_code" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT,
    "location" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT,
    "admin_name" TEXT,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "changes" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "status_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "desktop_image_url" TEXT NOT NULL,
    "mobile_image_url" TEXT NOT NULL,
    "link" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "target_type" TEXT NOT NULL DEFAULT 'ALL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "applies_to" "PromoAppliesTo" NOT NULL DEFAULT 'ALL',
    "specific_product_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "excluded_product_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "allowed_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requires_auth" BOOLEAN NOT NULL DEFAULT false,
    "max_uses" INTEGER,
    "max_uses_per_user" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "max_items" INTEGER,
    "min_order_amount" DOUBLE PRECISION,
    "exclude_new_items" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_by" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_usage" (
    "id" SERIAL NOT NULL,
    "promo_code_id" INTEGER NOT NULL,
    "user_id" TEXT,
    "order_id" TEXT,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_telegram_id_key" ON "admins"("telegram_id");

-- CreateIndex
CREATE INDEX "admins_is_active_idx" ON "admins"("is_active");

-- CreateIndex
CREATE INDEX "admins_telegram_id_idx" ON "admins"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_login_requests_login_id_key" ON "admin_login_requests"("login_id");

-- CreateIndex
CREATE INDEX "admin_login_requests_login_id_idx" ON "admin_login_requests"("login_id");

-- CreateIndex
CREATE INDEX "admin_login_requests_approved_idx" ON "admin_login_requests"("approved");

-- CreateIndex
CREATE INDEX "admin_login_requests_created_at_idx" ON "admin_login_requests"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_admin_id_idx" ON "audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "banners_is_active_idx" ON "banners"("is_active");

-- CreateIndex
CREATE INDEX "cart_items_user_id_idx" ON "cart_items"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_user_id_product_id_size_key" ON "cart_items"("user_id", "product_id", "size");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns"("status");

-- CreateIndex
CREATE INDEX "email_campaigns_created_at_idx" ON "email_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "promo_codes_code_idx" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_is_active_idx" ON "promo_codes"("is_active");

-- CreateIndex
CREATE INDEX "promo_codes_valid_from_valid_until_idx" ON "promo_codes"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "promo_code_usage_promo_code_id_idx" ON "promo_code_usage"("promo_code_id");

-- CreateIndex
CREATE INDEX "promo_code_usage_user_id_idx" ON "promo_code_usage"("user_id");

-- CreateIndex
CREATE INDEX "promo_code_usage_order_id_idx" ON "promo_code_usage"("order_id");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usage" ADD CONSTRAINT "promo_code_usage_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usage" ADD CONSTRAINT "promo_code_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usage" ADD CONSTRAINT "promo_code_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
