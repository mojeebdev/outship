-- The weekly and monthly leaderboards, the rising strip and the home feed
-- read ships by time across every builder.
CREATE INDEX "Ship_shippedAt_idx" ON "Ship"("shippedAt");
