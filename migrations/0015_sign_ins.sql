-- Sign-ins, for the admin KPIs (daily, weekly and monthly active builders).
-- Only the builder and the time; nothing about the device or network.
ALTER TABLE "Builder" ADD COLUMN "lastSignedInAt" DATETIME;

CREATE TABLE "SignInEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "builderId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignInEvent_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Builder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SignInEvent_at_idx" ON "SignInEvent"("at");
