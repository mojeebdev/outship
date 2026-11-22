-- Account-level preference for transactional earned-Shipmark notifications.
-- Existing builders default to enabled; the profile settings switch can opt out.
ALTER TABLE "Builder" ADD COLUMN "shipmarkEmailsEnabled" BOOLEAN NOT NULL DEFAULT 1;
