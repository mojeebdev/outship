-- Ship.commitSha becomes nullable. A release's target_commitish is often a
-- branch name ("main"), which would put a moving pointer into a permanent
-- attestation; the webhook now resolves the tag to its commit, and stores NULL
-- when it can't, which blocks attesting that ship until it's resolved.
--
-- SQLite can't drop NOT NULL in place, so the table is rebuilt. Attestation
-- references Ship with ON DELETE RESTRICT, which SQLite enforces immediately
-- even when foreign keys are deferred, so dropping Ship would fail while any
-- attestation exists. Attestation is therefore set aside first (rows copied to
-- a plain table), Ship is rebuilt, and Attestation is recreated with its
-- original definition and every row restored. Ids don't change.
PRAGMA defer_foreign_keys = true;

CREATE TABLE "Attestation_backup" AS SELECT * FROM "Attestation";
DROP TABLE "Attestation";

CREATE TABLE "new_Ship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "builderId" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "shipType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "commitSha" TEXT,
    "shippedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "weightClass" TEXT NOT NULL DEFAULT 'STANDARD',
    "releaseHasNotes" BOOLEAN,
    "language" TEXT,
    CONSTRAINT "Ship_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Anything that isn't a full 40-character lowercase hex SHA (in practice a
-- release's branch name) becomes NULL.
INSERT INTO "new_Ship" ("id", "builderId", "repo", "shipType", "identifier", "commitSha", "shippedAt", "createdAt", "isPrivate", "weightClass", "releaseHasNotes", "language")
SELECT "id", "builderId", "repo", "shipType", "identifier",
       CASE WHEN length("commitSha") = 40 AND "commitSha" NOT GLOB '*[^0-9a-f]*' THEN "commitSha" ELSE NULL END,
       "shippedAt", "createdAt", "isPrivate", "weightClass", "releaseHasNotes", "language"
  FROM "Ship";

DROP TABLE "Ship";
ALTER TABLE "new_Ship" RENAME TO "Ship";

CREATE INDEX "Ship_builderId_shippedAt_idx" ON "Ship"("builderId", "shippedAt");
CREATE UNIQUE INDEX "Ship_repo_shipType_identifier_key" ON "Ship"("repo", "shipType", "identifier");
CREATE INDEX "Ship_shippedAt_idx" ON "Ship"("shippedAt");
-- The merge/push dedupe in the webhook looks ships up by commit.
CREATE INDEX "Ship_commitSha_idx" ON "Ship"("commitSha");

CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipId" TEXT NOT NULL,
    "easUid" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'base',
    "scoreSnapshot" INTEGER NOT NULL,
    "attestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Attestation_shipId_fkey" FOREIGN KEY ("shipId") REFERENCES "Ship" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "Attestation" ("id", "shipId", "easUid", "txHash", "chain", "scoreSnapshot", "attestedAt", "schemaVersion")
SELECT "id", "shipId", "easUid", "txHash", "chain", "scoreSnapshot", "attestedAt", "schemaVersion" FROM "Attestation_backup";
DROP TABLE "Attestation_backup";

CREATE UNIQUE INDEX "Attestation_shipId_key" ON "Attestation"("shipId");
CREATE UNIQUE INDEX "Attestation_easUid_key" ON "Attestation"("easUid");
