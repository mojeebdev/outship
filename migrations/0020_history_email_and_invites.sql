-- When the "your last 12 months are in" email went out (src/lib/email/
-- history-ready.ts). Set before sending, so each builder gets it once.
ALTER TABLE "Builder" ADD COLUMN "historyEmailedAt" DATETIME;

-- Who invited this builder: the inviter's Builder id, from the ?ref= on the
-- invite's join link (src/lib/invites.ts). Null for everyone else.
ALTER TABLE "Builder" ADD COLUMN "referredById" TEXT;

-- One email invite from a builder to a friend. The email is unique: an
-- address is invited at most once, ever, whoever asks. The token is the
-- friend's "never email me again" link; optedOutAt records that they used it.
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviterId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "optedOutAt" DATETIME,
    CONSTRAINT "Invite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "Builder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invite_email_key" ON "Invite"("email");
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_inviterId_idx" ON "Invite"("inviterId");
