-- The 12-month history import is back: when the App is installed, the last
-- year of merged PRs, published releases and commits (up to 5 a day, scored
-- as pushes) from the repos it can see is imported, so a new builder's all-time
-- score reflects their real history. 0016 dropped its queue when the import
-- was wrongly removed; this recreates it exactly as 0013 had it.
--
-- Every live installation starts unqueued (backfillQueuedAt is NULL), so the
-- next runs import each one. Ships already imported are kept and never
-- duplicated: an import writes only ships it doesn't have.
ALTER TABLE "Installation" ADD COLUMN "backfillQueuedAt" DATETIME;

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

CREATE UNIQUE INDEX "BackfillJob_kind_repo_key" ON "BackfillJob"("kind", "repo");
CREATE INDEX "BackfillJob_status_idx" ON "BackfillJob"("status");
