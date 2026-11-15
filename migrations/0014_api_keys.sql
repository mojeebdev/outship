-- API v1 keys. Only a SHA-256 hash of each key is stored: the key itself is
-- shown once, when it's created, and can't be recovered from the database.
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    -- Who it was issued to (a company or a person), and how to reach them.
    "owner" TEXT NOT NULL,
    "contact" TEXT,
    -- The first characters of the key ("os_live_ab12"), to recognise it by.
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "ratePerMinute" INTEGER NOT NULL DEFAULT 120,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME
);
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");

-- Requests per key per UTC day, for the admin KPIs. keyId 'anonymous' counts
-- requests made without a key.
CREATE TABLE "ApiUsage" (
    "keyId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("keyId", "day")
);
