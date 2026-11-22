import assert from "node:assert/strict";
import test from "node:test";
import { ask, BUYER_QUESTIONS, detectMention, dueProvider, loadWeeklyReport, providerConfigs, runDailyCheck, runProvider, weeklyReport, type CheckRow } from "../ai-mentions";
import { d1, migratedDb } from "./sqlite-d1";

const json = (body: unknown) => async () => Response.json(body);

test("providers without a key are skipped and named, never counted as zero", () => {
  const { configured, missing } = providerConfigs({ ANTHROPIC_API_KEY: "a", PERPLEXITY_API_KEY: "p", AI_MONITOR_PERPLEXITY_MODEL: "sonar-pro" });
  assert.deepEqual(configured.map((c) => c.provider), ["anthropic", "perplexity"]);
  assert.equal(configured[1].model, "sonar-pro");
  assert.deepEqual(missing, [{ provider: "openai", key: "OPENAI_API_KEY" }, { provider: "gemini", key: "GEMINI_API_KEY" }]);
});

test("a mention is the brand name or an outship.dev link, in text or citations", () => {
  assert.deepEqual(detectMention({ text: "Try outship for proof.", citedUrls: [] }), { mentioned: true, linked: false });
  assert.deepEqual(detectMention({ text: "See the registry.", citedUrls: ["https://outship.dev/leaderboard"] }), { mentioned: true, linked: true });
  assert.deepEqual(detectMention({ text: "Product Hunt and BetaList.", citedUrls: ["https://notoutship.dev.example"] }), { mentioned: false, linked: false });
});

test("each provider's answer and citations are read from its own response shape", async () => {
  const anthropic = await ask({ provider: "anthropic", model: "m", apiKey: "k" }, "q", json({
    content: [
      { type: "web_search_tool_result", content: [{ url: "https://a.example/1" }] },
      { type: "text", text: "Use outship.", citations: [{ url: "https://outship.dev/" }] },
    ],
  }));
  assert.equal(anthropic.text, "Use outship.");
  assert.deepEqual(anthropic.citedUrls.sort(), ["https://a.example/1", "https://outship.dev/"]);

  const openai = await ask({ provider: "openai", model: "m", apiKey: "k" }, "q", json({
    output: [{ type: "message", content: [{ type: "output_text", text: "Answer", annotations: [{ type: "url_citation", url: "https://b.example" }] }] }],
  }));
  assert.deepEqual(openai, { text: "Answer", citedUrls: ["https://b.example"] });

  const perplexity = await ask({ provider: "perplexity", model: "sonar", apiKey: "k" }, "q", json({
    choices: [{ message: { content: "P answer" } }], citations: ["https://c.example"], search_results: [{ url: "https://d.example" }],
  }));
  assert.deepEqual(perplexity, { text: "P answer", citedUrls: ["https://c.example", "https://d.example"] });

  const gemini = await ask({ provider: "gemini", model: "g", apiKey: "k" }, "q", json({
    candidates: [{ content: { parts: [{ text: "G answer" }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://e.example" } }] } }],
  }));
  assert.deepEqual(gemini, { text: "G answer", citedUrls: ["https://e.example"] });
});

test("a failing provider records an error per question and never throws", async () => {
  const rows = await runProvider({ provider: "openai", model: "m", apiKey: "k" }, "2026-11-22", async () => new Response("no", { status: 429 }));
  assert.equal(rows.length, BUYER_QUESTIONS.length);
  assert.ok(rows.every((row) => row.error === "openai returned HTTP 429" && !row.mentioned));
});

test("the weekly report gives rates per model, mentions per question and third-party cited domains", () => {
  const row = (over: Partial<CheckRow>): CheckRow => ({
    runDate: "2026-11-22", provider: "anthropic", model: "m", question: BUYER_QUESTIONS[0], answer: "", mentioned: false, linked: false, citedUrls: [], error: null, ...over,
  });
  const report = weeklyReport([
    row({ mentioned: true, linked: true, citedUrls: ["https://outship.dev/", "https://www.reddit.com/r/SideProject"] }),
    row({ question: BUYER_QUESTIONS[1], citedUrls: ["https://reddit.com/x"] }),
    row({ provider: "openai", error: "openai returned HTTP 500" }),
  ], "2026-11-16", "2026-11-22", []);
  const claude = report.models.find((m) => m.provider === "anthropic")!;
  assert.equal(claude.mentionRate, 0.5);
  assert.equal(claude.linkRate, 0.5);
  const openai = report.models.find((m) => m.provider === "openai")!;
  assert.equal(openai.errors, 1);
  assert.equal(openai.mentionRate, 0);
  assert.deepEqual(report.questions[0].mentionedBy, ["anthropic"]);
  assert.deepEqual(report.citedDomains, [{ domain: "reddit.com", citations: 2, providers: 1 }]);
});

test("one provider is due per hour at minute 10 from 06:00 UTC", () => {
  assert.equal(dueProvider(Date.UTC(2026, 10, 22, 6, 10)), "anthropic");
  assert.equal(dueProvider(Date.UTC(2026, 10, 22, 7, 10)), "openai");
  assert.equal(dueProvider(Date.UTC(2026, 10, 22, 9, 10)), "gemini");
  assert.equal(dueProvider(Date.UTC(2026, 10, 22, 10, 10)), undefined);
  assert.equal(dueProvider(Date.UTC(2026, 10, 22, 7, 20)), undefined);
});

test("a daily run stores answers once per day against the real migration, and the weekly report reads them back", async () => {
  const db = d1(migratedDb());
  const env = { PERPLEXITY_API_KEY: "k" };
  const now = Date.UTC(2026, 10, 22, 8, 10);
  const fetcher = async () => Response.json({ choices: [{ message: { content: "outship is good" } }], citations: ["https://dev.to/x"] });
  assert.equal(await runDailyCheck(db as never, "openai", env, now, fetcher), "skipped: openai has no API key");
  assert.equal(await runDailyCheck(db as never, "perplexity", env, now, fetcher), `ok: ${BUYER_QUESTIONS.length} answers`);
  assert.equal(await runDailyCheck(db as never, "perplexity", env, now, fetcher), "already ran today");
  const report = await loadWeeklyReport(db as never, env, now);
  assert.equal(report.models[0].mentionRate, 1);
  assert.deepEqual(report.citedDomains, [{ domain: "dev.to", citations: BUYER_QUESTIONS.length, providers: 1 }]);
  assert.ok(report.missing.some((m) => m.provider === "openai"));
});
