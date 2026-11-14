-- Builder: the GitHub-verified email used for the welcome and account email.
ALTER TABLE "Builder" ADD COLUMN "email" TEXT;
ALTER TABLE "Builder" ADD COLUMN "welcomedAt" DATETIME;

-- Subscriber: double opt-in, unsubscribe, and resumable weekly sends.
ALTER TABLE "Subscriber" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Subscriber" ADD COLUMN "token" TEXT;
ALTER TABLE "Subscriber" ADD COLUMN "confirmedAt" DATETIME;
ALTER TABLE "Subscriber" ADD COLUMN "unsubscribedAt" DATETIME;
ALTER TABLE "Subscriber" ADD COLUMN "lastConfirmSentAt" DATETIME;
ALTER TABLE "Subscriber" ADD COLUMN "recapSentFor" TEXT;

-- Everyone who signed up before double opt-in gets a token (128 random bits),
-- so a confirmation link can reach them later. They stay PENDING until then.
UPDATE "Subscriber" SET "token" = lower(hex(randomblob(16))) WHERE "token" IS NULL;

CREATE UNIQUE INDEX "Subscriber_token_key" ON "Subscriber"("token");
CREATE INDEX "Subscriber_status_idx" ON "Subscriber"("status");
