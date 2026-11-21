-- Shipmarks: immutable achievement snapshots derived from verified Outship activity.
CREATE TABLE "Shipmark" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "builderId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "earnedAt" DATETIME NOT NULL,
  "snapshot" TEXT NOT NULL DEFAULT '{}',
  "source" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "notificationSentAt" DATETIME,
  CONSTRAINT "Shipmark_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Shipmark_builderId_code_period_key" ON "Shipmark"("builderId", "code", "period");
CREATE INDEX "Shipmark_builderId_earnedAt_idx" ON "Shipmark"("builderId", "earnedAt");
CREATE INDEX "Shipmark_code_period_idx" ON "Shipmark"("code", "period");
