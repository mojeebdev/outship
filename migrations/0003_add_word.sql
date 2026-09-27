-- Word (word.outship.dev): homepage leaderboard + rate limit counters.

-- CreateTable
CREATE TABLE "WordSite" (
    "hostname" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "charCount" INTEGER NOT NULL,
    "scanCount" INTEGER NOT NULL DEFAULT 1,
    "listedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "WordSite_wordCount_idx" ON "WordSite"("wordCount");

-- CreateTable
CREATE TABLE "WordRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "windowStart" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);
