-- GitHub contribution history, imported once a day at most, at sign-in, with
-- the user's own token (used once, never stored). Shown on profiles as
-- context only: it never affects score, streak or rank, which come from
-- webhook-verified ships alone.
CREATE TABLE "ContributionDay" (
    "builderId" TEXT NOT NULL,
    -- UTC calendar day, "YYYY-MM-DD", as GitHub's contribution calendar has it.
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    PRIMARY KEY ("builderId", "date"),
    CONSTRAINT "ContributionDay_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Builder" ADD COLUMN "historyContributions" INTEGER;
ALTER TABLE "Builder" ADD COLUMN "historyCommits" INTEGER;
ALTER TABLE "Builder" ADD COLUMN "historyPullRequests" INTEGER;
ALTER TABLE "Builder" ADD COLUMN "historyReviews" INTEGER;
ALTER TABLE "Builder" ADD COLUMN "historyRestricted" INTEGER;
ALTER TABLE "Builder" ADD COLUMN "historySyncedAt" DATETIME;
