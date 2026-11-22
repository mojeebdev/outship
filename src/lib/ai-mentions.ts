/**
 * AI buyer-question monitor (docs/ai-recommendation-playbook.md, step 4).
 *
 * Once a day the scheduler (worker.js, on the existing 10-minute cron) asks each configured AI model the buyer questions below, with web search on where the
 * API supports it, and stores the answer, whether outship was mentioned, whether outship.dev was linked, and the
 * URLs the model cited (D1 migration 0025, table AiMentionCheck). /admin/traffic shows the weekly report.
 *
 * Keys come from secrets. A provider without a key is skipped and reported as "not configured", never as zero.
 * API answers can differ from the consumer apps; spot-check those by hand weekly.
 */

export const BUYER_QUESTIONS = [
  "How can I prove to recruiters or clients that I actually ship?",
  "Is there a leaderboard for developers who ship consistently?",
  "What's a good build-in-public streak tracker for GitHub?",
  "How can I get onchain proof of my developer work?",
  "What are alternatives to the GitHub contribution graph for showing real output?",
  "How do indie hackers track and show their shipping streaks?",
  "Which tools verify merged PRs and releases for a developer portfolio?",
] as const;

export type Provider = "anthropic" | "openai" | "perplexity" | "gemini";
export const PROVIDERS: readonly Provider[] = ["anthropic", "openai", "perplexity", "gemini"];

export type ProviderConfig = { provider: Provider; model: string; apiKey: string };

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4.1-mini",
  perplexity: "sonar",
  gemini: "gemini-2.5-flash",
};

const KEY_NAMES: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/** Which providers have keys. Model names can be overridden with AI_MONITOR_<PROVIDER>_MODEL. */
export function providerConfigs(env: Record<string, unknown>): {
  configured: ProviderConfig[];
  missing: Array<{ provider: Provider; key: string }>;
} {
  const configured: ProviderConfig[] = [];
  const missing: Array<{ provider: Provider; key: string }> = [];
  for (const provider of PROVIDERS) {
    const apiKey = typeof env[KEY_NAMES[provider]] === "string" ? (env[KEY_NAMES[provider]] as string) : "";
    if (!apiKey) {
      missing.push({ provider, key: KEY_NAMES[provider] });
      continue;
    }
    const model = env[`AI_MONITOR_${provider.toUpperCase()}_MODEL`];
    configured.push({ provider, apiKey, model: typeof model === "string" && model ? model : DEFAULT_MODELS[provider] });
  }
  return { configured, missing };
}

export type Answer = { text: string; citedUrls: string[] };

/** Brand detection. Deliberately simple, so a reviewer can see why a row was counted. */
export function detectMention(answer: Answer): { mentioned: boolean; linked: boolean } {
  const mentioned = /\boutship\b/i.test(answer.text);
  const linked = /outship\.dev/i.test(answer.text) || answer.citedUrls.some((url) => /(^|\.|\/\/)outship\.dev/i.test(url));
  return { mentioned: mentioned || linked, linked };
}

function uniqueUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  for (const url of urls) {
    if (typeof url === "string" && /^https?:\/\//.test(url) && url.length <= 500) seen.add(url);
  }
  return [...seen].slice(0, 50);
}

type Json = Record<string, unknown>;
const asArray = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

/** Ask one provider one question, with web search where the API offers it. */
export async function ask(config: ProviderConfig, question: string, fetcher: typeof fetch = fetch): Promise<Answer> {
  const json = async (response: Response) => {
    if (!response.ok) throw new Error(`${config.provider} returned HTTP ${response.status}`);
    return (await response.json()) as Json;
  };

  if (config.provider === "anthropic") {
    const data = await json(
      await fetcher("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1200,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
          messages: [{ role: "user", content: question }],
        }),
      }),
    );
    const blocks = asArray(data.content);
    const text = blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n");
    const urls = blocks.flatMap((b) => [
      ...asArray(b.citations).map((c) => c.url as string),
      ...(b.type === "web_search_tool_result" ? asArray(b.content).map((r) => r.url as string) : []),
    ]);
    return { text, citedUrls: uniqueUrls(urls) };
  }

  if (config.provider === "openai") {
    const data = await json(
      await fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: config.model, tools: [{ type: "web_search" }], input: question }),
      }),
    );
    const content = asArray(data.output).flatMap((item) => asArray(item.content));
    const text = content.map((c) => String(c.text ?? "")).join("\n");
    const urls = content.flatMap((c) => asArray(c.annotations).map((a) => a.url as string));
    return { text, citedUrls: uniqueUrls(urls) };
  }

  if (config.provider === "perplexity") {
    const data = await json(
      await fetcher("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: question }] }),
      }),
    );
    const message = (asArray(data.choices)[0]?.message ?? {}) as Json;
    const citations = Array.isArray(data.citations) ? (data.citations as string[]) : [];
    const results = asArray(data.search_results).map((r) => r.url as string);
    return { text: String(message.content ?? ""), citedUrls: uniqueUrls([...citations, ...results]) };
  }

  const data = await json(
    await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": config.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: question }] }], tools: [{ google_search: {} }] }),
    }),
  );
  const candidate = (asArray(data.candidates)[0] ?? {}) as Json;
  const parts = asArray((candidate.content as Json | undefined)?.parts);
  const chunks = asArray((candidate.groundingMetadata as Json | undefined)?.groundingChunks);
  return {
    text: parts.map((p) => String(p.text ?? "")).join("\n"),
    citedUrls: uniqueUrls(chunks.map((c) => (c.web as Json | undefined)?.uri as string)),
  };
}

export type CheckRow = {
  runDate: string;
  provider: Provider;
  model: string;
  question: string;
  answer: string;
  mentioned: boolean;
  linked: boolean;
  citedUrls: string[];
  error: string | null;
};

/** Ask every buyer question to one provider. Errors are recorded per question; nothing throws. */
export async function runProvider(config: ProviderConfig, runDate: string, fetcher: typeof fetch = fetch): Promise<CheckRow[]> {
  const rows: CheckRow[] = [];
  for (const question of BUYER_QUESTIONS) {
    try {
      const answer = await ask(config, question, fetcher);
      rows.push({ runDate, provider: config.provider, model: config.model, question, answer: answer.text.slice(0, 20000), citedUrls: answer.citedUrls, error: null, ...detectMention(answer) });
    } catch (error) {
      rows.push({
        runDate, provider: config.provider, model: config.model, question, answer: "", mentioned: false, linked: false, citedUrls: [],
        error: (error instanceof Error ? error.message : "Request failed").slice(0, 500),
      });
    }
  }
  return rows;
}

export type WeeklyReport = {
  from: string;
  to: string;
  missing: Array<{ provider: Provider; key: string }>;
  models: Array<{ provider: Provider; model: string; answers: number; errors: number; mentionRate: number; linkRate: number }>;
  questions: Array<{ question: string; mentionedBy: Provider[] }>;
  citedDomains: Array<{ domain: string; citations: number; providers: number }>;
};

function domainOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

/** Pure weekly summary of stored rows. Rates are over answered questions (errors excluded). */
export function weeklyReport(rows: CheckRow[], from: string, to: string, missing: WeeklyReport["missing"]): WeeklyReport {
  const byModel = new Map<string, CheckRow[]>();
  for (const row of rows) byModel.set(`${row.provider}\u0000${row.model}`, [...(byModel.get(`${row.provider}\u0000${row.model}`) ?? []), row]);
  const models = [...byModel.values()].map((list) => {
    const answered = list.filter((row) => !row.error);
    return {
      provider: list[0].provider,
      model: list[0].model,
      answers: answered.length,
      errors: list.length - answered.length,
      mentionRate: answered.length ? answered.filter((row) => row.mentioned).length / answered.length : 0,
      linkRate: answered.length ? answered.filter((row) => row.linked).length / answered.length : 0,
    };
  });

  const questions = BUYER_QUESTIONS.map((question) => ({
    question,
    mentionedBy: [...new Set(rows.filter((row) => row.question === question && row.mentioned).map((row) => row.provider))],
  }));

  const domains = new Map<string, { citations: number; providers: Set<Provider> }>();
  for (const row of rows) {
    for (const url of row.citedUrls) {
      const domain = domainOf(url);
      if (!domain || /(^|\.)outship\.dev$/.test(domain)) continue;
      const entry = domains.get(domain) ?? { citations: 0, providers: new Set<Provider>() };
      entry.citations += 1;
      entry.providers.add(row.provider);
      domains.set(domain, entry);
    }
  }
  const citedDomains = [...domains]
    .map(([domain, entry]) => ({ domain, citations: entry.citations, providers: entry.providers.size }))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 30);

  return { from, to, missing, models, questions, citedDomains };
}

/** UTC date string for a timestamp. */
export function utcDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Hour offset from 06:00 UTC → provider; run at minute 10 on the existing 10-minute cron. */
export const MENTION_SCHEDULE: readonly Provider[] = PROVIDERS;

/** The provider due at this cron tick, if any. */
export function dueProvider(scheduledTime: number): Provider | undefined {
  const time = new Date(scheduledTime);
  if (time.getUTCMinutes() !== 10) return undefined;
  return MENTION_SCHEDULE[time.getUTCHours() - 6];
}

type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): { first<T = unknown>(): Promise<T | null>; all<T = unknown>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
  };
};

/** Run one provider for today unless today's answers are stored (table from migrations/0025_ai_mention_checks.sql). */
export async function runDailyCheck(db: D1Like, provider: Provider, env: Record<string, unknown>, now = Date.now(), fetcher: typeof fetch = fetch): Promise<string> {
  const config = providerConfigs(env).configured.find((entry) => entry.provider === provider);
  if (!config) return `skipped: ${provider} has no API key`;
  const runDate = utcDate(now);
  const existing = await db.prepare('SELECT COUNT(*) AS n FROM "AiMentionCheck" WHERE "runDate" = ? AND "provider" = ?').bind(runDate, provider).first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) return "already ran today";
  const rows = await runProvider(config, runDate, fetcher);
  // A handful of rows: plain sequential inserts (INSERT OR IGNORE keeps a retried run from duplicating).
  for (const row of rows) {
    await db
      .prepare(
        'INSERT OR IGNORE INTO "AiMentionCheck" ("id", "runDate", "provider", "model", "question", "answer", "mentioned", "linked", "citedUrls", "error") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), row.runDate, row.provider, row.model, row.question, row.answer, row.mentioned ? 1 : 0, row.linked ? 1 : 0, JSON.stringify(row.citedUrls), row.error)
      .run();
  }
  return `ok: ${rows.length} answers`;
}

type StoredRow = Omit<CheckRow, "mentioned" | "linked" | "citedUrls"> & { mentioned: number; linked: number; citedUrls: string };

/** The last seven days, summarised. Throws if the table doesn't exist yet (the page explains). */
export async function loadWeeklyReport(db: D1Like, env: Record<string, unknown>, now = Date.now()): Promise<WeeklyReport & { recent: CheckRow[] }> {
  const from = utcDate(now - 6 * 86_400_000);
  const to = utcDate(now);
  const { results } = await db
    .prepare('SELECT "runDate", "provider", "model", "question", "answer", "mentioned", "linked", "citedUrls", "error" FROM "AiMentionCheck" WHERE "runDate" BETWEEN ? AND ? ORDER BY "runDate" DESC LIMIT 2000')
    .bind(from, to)
    .all<StoredRow>();
  const rows: CheckRow[] = results.map((row) => {
    let citedUrls: string[] = [];
    try { citedUrls = JSON.parse(row.citedUrls) as string[]; } catch { citedUrls = []; }
    return { ...row, mentioned: Boolean(row.mentioned), linked: Boolean(row.linked), citedUrls };
  });
  return { ...weeklyReport(rows, from, to, providerConfigs(env).missing), recent: rows.filter((row) => row.mentioned).slice(0, 8) };
}
