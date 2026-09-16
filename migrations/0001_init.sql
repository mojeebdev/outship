-- CreateTable
CREATE TABLE "Builder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" INTEGER NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "installationId" INTEGER,
    "walletAddress" TEXT,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastShipDate" DATETIME,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "builderId" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "shipType" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "shippedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ship_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipId" TEXT NOT NULL,
    "easUid" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'base',
    "scoreSnapshot" INTEGER NOT NULL,
    "attestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attestation_shipId_fkey" FOREIGN KEY ("shipId") REFERENCES "Ship" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Builder_githubId_key" ON "Builder"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Builder_githubLogin_key" ON "Builder"("githubLogin");

-- CreateIndex
CREATE INDEX "Builder_score_idx" ON "Builder"("score");

-- CreateIndex
CREATE INDEX "Ship_builderId_shippedAt_idx" ON "Ship"("builderId", "shippedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ship_repo_shipType_identifier_key" ON "Ship"("repo", "shipType", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_shipId_key" ON "Attestation"("shipId");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_easUid_key" ON "Attestation"("easUid");

