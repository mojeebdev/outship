-- What a ship is worth is decided when its webhook arrives and stored, so
-- scoring stays a pure function of stored ships (src/lib/score.ts).
-- weightClass: MERGE ships merged by someone other than their author are
-- REVIEWED, outside contributions are EXTERNAL; everything else STANDARD.
ALTER TABLE "Ship" ADD COLUMN "weightClass" TEXT NOT NULL DEFAULT 'STANDARD';
-- RELEASE ships: whether the release had a body or an asset. NULL for
-- releases recorded before this was checked (scored as full releases).
ALTER TABLE "Ship" ADD COLUMN "releaseHasNotes" BOOLEAN;
-- repository.language at the time of the ship, for the language filter.
ALTER TABLE "Ship" ADD COLUMN "language" TEXT;

-- Bumped on every write of a builder's score or streak, so a webhook that
-- recomputed from a stale read can tell and recompute again.
ALTER TABLE "Builder" ADD COLUMN "statsVersion" INTEGER NOT NULL DEFAULT 0;
