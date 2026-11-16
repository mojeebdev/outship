-- The one note from Mojeeb to a builder who uninstalled the GitHub App
-- (src/lib/email/uninstall-note.ts). Set before sending, so at most once.
ALTER TABLE "Builder" ADD COLUMN "uninstallEmailedAt" DATETIME;
