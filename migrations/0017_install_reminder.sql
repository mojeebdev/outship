-- The one-time "install the GitHub App" reminder, sent about 30 minutes
-- after a builder signs in if the App still isn't installed. Set when the
-- reminder is claimed for sending, so each builder gets it at most once.
ALTER TABLE "Builder" ADD COLUMN "installReminderSentAt" DATETIME;
