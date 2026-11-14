-- Unclaimed profiles. The webhook creates a Builder for anyone who ships in a
-- repo where the App is installed, signed in or not. claimedAt says whether
-- the person behind a profile has ever signed in; hidden lets them take it off
-- public pages; claimInvitedAt makes the one-time claim comment at most once.
ALTER TABLE "Builder" ADD COLUMN "claimedAt" DATETIME;
ALTER TABLE "Builder" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Builder" ADD COLUMN "claimInvitedAt" DATETIME;

-- Public GitHub profile fields, read from GET /user at sign-in.
ALTER TABLE "Builder" ADD COLUMN "name" TEXT;
ALTER TABLE "Builder" ADD COLUMN "bio" TEXT;
ALTER TABLE "Builder" ADD COLUMN "location" TEXT;
ALTER TABLE "Builder" ADD COLUMN "blog" TEXT;
ALTER TABLE "Builder" ADD COLUMN "twitterUsername" TEXT;

-- Backfill: these four are only ever written by a real sign-in (the OAuth
-- callback and the signed-in attest route), never by the webhook, so any of
-- them being set means the person has signed in at least once.
UPDATE "Builder" SET "claimedAt" = "createdAt"
 WHERE "claimedAt" IS NULL
   AND ("welcomedAt" IS NOT NULL
     OR "installationId" IS NOT NULL
     OR "email" IS NOT NULL
     OR "walletAddress" IS NOT NULL);

-- GitHub App installations, kept current from installation webhooks and from
-- payload.installation on every other delivery.
CREATE TABLE "Installation" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "claimInvitesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" DATETIME,
    "deletedAt" DATETIME
);
