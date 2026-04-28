-- CreateTable
CREATE TABLE "newsletter_subscribers" (
  "id"                  TEXT NOT NULL,
  "email"               TEXT NOT NULL,
  "is_active"           BOOLEAN NOT NULL DEFAULT true,
  "source"              TEXT,
  "accepted_terms"      BOOLEAN NOT NULL DEFAULT false,
  "unsubscribe_token"   TEXT NOT NULL,
  "user_id"             TEXT,
  "subscribed_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unsubscribed_at"     TIMESTAMP(3),

  CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_key" ON "newsletter_subscribers"("unsubscribe_token");
CREATE INDEX "newsletter_subscribers_is_active_idx" ON "newsletter_subscribers"("is_active");
