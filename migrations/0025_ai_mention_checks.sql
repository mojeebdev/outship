-- AI buyer-question monitor (docs/ai-recommendation-playbook.md, step 4). Additive: one new, empty table.
-- One row per (day, provider, question): the answer an AI model gave, whether it mentioned outship, whether it
-- linked outship.dev, and the URLs it cited (JSON array). Model output about public questions only. No builder data.
-- NOT applied automatically: review, then `npx wrangler d1 migrations apply DB --remote` yourself.
CREATE TABLE "AiMentionCheck" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runDate" TEXT NOT NULL,
  "provider" TEXT NOT NULL CHECK ("provider" IN ('anthropic', 'openai', 'perplexity', 'gemini')),
  "model" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL DEFAULT '',
  "mentioned" INTEGER NOT NULL DEFAULT 0,
  "linked" INTEGER NOT NULL DEFAULT 0,
  "citedUrls" TEXT NOT NULL DEFAULT '[]',
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AiMentionCheck_runDate_provider_question_key" ON "AiMentionCheck"("runDate", "provider", "question");
CREATE INDEX "AiMentionCheck_createdAt_idx" ON "AiMentionCheck"("createdAt");
