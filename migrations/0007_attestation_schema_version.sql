-- Attestation: which EAS schema wrote it. Every existing row was written with
-- schema v1, which had no resolver and so can't be verified; from schema v2 on,
-- the server checks each attestation onchain before storing it (and writes 2).
ALTER TABLE "Attestation" ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;
