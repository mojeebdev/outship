-- Word: saved, shareable scan results (word.outship.dev/result/{id}).

-- CreateTable
CREATE TABLE "WordResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "isHomepage" BOOLEAN NOT NULL,
    "words" INTEGER NOT NULL,
    "characters" INTEGER NOT NULL,
    "scanMs" INTEGER NOT NULL,
    "benchmarkWords" INTEGER NOT NULL,
    "benchmarkVersion" TEXT NOT NULL,
    "comparisonDirection" TEXT NOT NULL,
    "comparisonDifference" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "WordResult_createdAt_idx" ON "WordResult"("createdAt");
