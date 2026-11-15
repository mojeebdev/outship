-- The 12-month backfill. When the App is installed, outship imports the last
-- year of published releases and merged PRs from the repos it can see, so
-- all-time scores reflect real history. Dates come from GitHub's own merge and
-- publish times, which can't be backdated.

-- Where a ship came from: the live webhook, or the backfill.
ALTER TABLE "Ship" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WEBHOOK';

-- When this installation's repos were queued for the backfill.
ALTER TABLE "Installation" ADD COLUMN "backfillQueuedAt" DATETIME;

-- One unit of backfill work, done a slice at a time by the cron so a large
-- install never runs into a Worker's limits. kind: REPOS lists an
-- installation's repos and queues the other two kinds; RELEASES and PULLS page
-- through one repo. cursor is where the next page starts.
CREATE TABLE "BackfillJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "since" DATETIME NOT NULL,
    "cursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "imported" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- A repo's history is imported once per kind, whichever install asked first.
CREATE UNIQUE INDEX "BackfillJob_kind_repo_key" ON "BackfillJob"("kind", "repo");
CREATE INDEX "BackfillJob_status_idx" ON "BackfillJob"("status");
