-- The history import was a one-time job and has been removed: new builders
-- score from the moment they install the App. Its queue goes; the ships it
-- imported stay, still marked Ship.source = 'BACKFILL'.
DROP TABLE IF EXISTS "BackfillJob";
ALTER TABLE "Installation" DROP COLUMN "backfillQueuedAt";
