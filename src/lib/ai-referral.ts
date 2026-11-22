import { classifyAiAgent, loggablePath } from "./ai-agents";

/**
 * AI-assistant attribution (docs/ai-recommendation-playbook.md, step 5).
 *
 * A visit counts as "from an AI assistant" when the landing URL carries `?ref=ai` (our /for-ai link) or an AI
 * `utm_source` (ChatGPT adds utm_source=chatgpt.com), or when the Referer is an AI assistant's host. Only the
 * source name, landing path and event type are recorded, as aggregate counts in Workers Analytics Engine.
 * No IP, cookie value, user id or query string is stored, and no tracking cookie is set for visits.
 *
 * Sign-ups: the GitHub sign-in link reads the same signals from its own Referer (the Outship page the person
 * clicked "sign in" on) and carries the source through the 10-minute sign-in cookie, so the callback can count
 * a first sign-in by source. A visitor who browses to another page before signing in is not attributed.
 * That is the price of not tracking people between pages.
 */

export type AiSource =
  | "chatgpt"
  | "perplexity"
  | "claude"
  | "gemini"
  | "copilot"
  | "deepseek"
  | "grok"
  | "meta-ai"
  | "ai";

export const AI_SOURCES: readonly AiSource[] = [
  "chatgpt",
  "perplexity",
  "claude",
  "gemini",
  "copilot",
  "deepseek",
  "grok",
  "meta-ai",
  "ai",
];

/** Short-lived (10 min) cookie that carries the AI source from the sign-in link to the callback. */
export const SIGNUP_SOURCE_COOKIE = "outship_signup_src";

// Assistant hosts (Referer) and utm_source values. Hostnames match exactly or as a subdomain.
const HOSTS: ReadonlyArray<[string, AiSource]> = [
  ["chatgpt.com", "chatgpt"],
  ["chat.openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"],
  ["claude.ai", "claude"],
  ["gemini.google.com", "gemini"],
  ["bard.google.com", "gemini"],
  ["copilot.microsoft.com", "copilot"],
  ["chat.deepseek.com", "deepseek"],
  ["grok.com", "grok"],
  ["meta.ai", "meta-ai"],
];

function hostSource(host: string): AiSource | null {
  const h = host.toLowerCase().replace(/^www\./, "");
  for (const [domain, source] of HOSTS) {
    if (h === domain || h.endsWith(`.${domain}`)) return source;
  }
  return null;
}

/** The AI source named by a URL's own parameters (?ref=ai, utm_source=chatgpt.com, …), or null. */
export function sourceFromParams(params: URLSearchParams): AiSource | null {
  if (params.get("ref")?.toLowerCase() === "ai") return "ai";
  const utm = params.get("utm_source")?.trim().toLowerCase();
  if (!utm) return null;
  return hostSource(utm) ?? validAiSource(utm);
}

/** The AI source for a landing request: its own parameters first, then the Referer host. */
export function aiReferralSource(url: URL, referer: string | null): AiSource | null {
  const fromParams = sourceFromParams(url.searchParams);
  if (fromParams) return fromParams;
  if (!referer) return null;
  try {
    return hostSource(new URL(referer).hostname);
  } catch {
    return null;
  }
}

/**
 * The AI source for a sign-in click. The sign-in link's Referer is the Outship page the person was on; only a
 * same-site Referer is trusted, and only its parameters are read (an AI Referer can't survive to this point).
 */
export function signupSourceFromReferer(referer: string | null, siteHost: string): AiSource | null {
  if (!referer) return null;
  try {
    const page = new URL(referer);
    if (page.hostname !== siteHost) return null;
    return sourceFromParams(page.searchParams);
  } catch {
    return null;
  }
}

export function validAiSource(raw: unknown): AiSource | null {
  return typeof raw === "string" && (AI_SOURCES as readonly string[]).includes(raw) ? (raw as AiSource) : null;
}

type AnalyticsEngineDataset = {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
};

export type AiReferralEnv = { AI_REFERRAL_EVENTS?: AnalyticsEngineDataset };

/**
 * Analytics Engine columns (dataset outship_ai_referrals): blob1 event ("visit" | "signup") · blob2 source ·
 * blob3 landing path (visits only) · index1 source.
 */
function write(env: AiReferralEnv, event: "visit" | "signup", source: AiSource, path: string): void {
  try {
    env.AI_REFERRAL_EVENTS?.writeDataPoint({ blobs: [event, source, path], doubles: [1], indexes: [source] });
  } catch {
    // Best-effort; never affects the response.
  }
}

/** Count a person's landing on a public HTML page from an AI assistant. Crawlers and agents are excluded. */
export function logAiReferralVisit(request: Request, response: Response, env: AiReferralEnv): void {
  try {
    if (request.method !== "GET" || response.status !== 200) return;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return;
    if (classifyAiAgent(request.headers.get("user-agent"), request.headers.get("signature-agent"))) return;
    const url = new URL(request.url);
    const path = loggablePath(url.pathname);
    if (!path) return;
    const source = aiReferralSource(url, request.headers.get("referer"));
    if (source) write(env, "visit", source, path);
  } catch {
    // Best-effort.
  }
}

/** Count a first sign-in that started from an AI-assistant landing. */
export function logAiSignup(env: AiReferralEnv, source: AiSource | null): void {
  if (source) write(env, "signup", source, "");
}

// ---------- Admin report ----------

export const AI_REFERRAL_DATASET = "outship_ai_referrals";

export type AiReferralReport =
  | { configured: false; reason: string }
  | {
      configured: true;
      visits: number;
      signups: number;
      bySource: { source: string; visits: number; signups: number }[];
      topLandings: { path: string; visits: number }[];
    };

export function buildReferralQuery(hours: number): string {
  const h = Math.max(1, Math.min(24 * 90, Math.floor(hours)));
  return `SELECT blob1 AS event, blob2 AS source, blob3 AS path, SUM(_sample_interval) AS hits
FROM ${AI_REFERRAL_DATASET}
WHERE timestamp > NOW() - INTERVAL '${h}' HOUR
GROUP BY event, source, path
ORDER BY hits DESC
LIMIT 1000`;
}

export function summarizeReferrals(rows: { event: string; source: string; path: string; hits: number }[]) {
  const by = new Map<string, { visits: number; signups: number }>();
  const landings = new Map<string, number>();
  let visits = 0;
  let signups = 0;
  for (const row of rows) {
    const entry = by.get(row.source) ?? { visits: 0, signups: 0 };
    if (row.event === "signup") {
      entry.signups += row.hits;
      signups += row.hits;
    } else if (row.event === "visit") {
      entry.visits += row.hits;
      visits += row.hits;
      landings.set(row.path, (landings.get(row.path) ?? 0) + row.hits);
    }
    by.set(row.source, entry);
  }
  return {
    configured: true as const,
    visits,
    signups,
    bySource: [...by].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.visits + b.signups - (a.visits + a.signups)),
    topLandings: [...landings].map(([path, v]) => ({ path, visits: v })).sort((a, b) => b.visits - a.visits),
  };
}

export async function loadAiReferralReport(
  hours: number,
  env: { accountId?: string; token?: string },
  fetcher: typeof fetch = fetch,
): Promise<AiReferralReport> {
  if (!env.accountId || !env.token) {
    return { configured: false, reason: "Not measured yet: needs the same CLOUDFLARE_ANALYTICS_TOKEN secret as traffic above." };
  }
  try {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/analytics_engine/sql`,
      { method: "POST", headers: { Authorization: `Bearer ${env.token}` }, body: buildReferralQuery(hours) },
    );
    if (!response.ok) {
      return { configured: false, reason: `Cloudflare returned ${response.status} for the AI referral query.` };
    }
    const payload = (await response.json()) as { data?: Record<string, unknown>[] };
    return summarizeReferrals(
      (payload.data ?? []).map((r) => ({
        event: String(r.event ?? ""),
        source: String(r.source ?? ""),
        path: String(r.path ?? ""),
        hits: Number(r.hits ?? 0),
      })),
    );
  } catch {
    return { configured: false, reason: "The AI referral query could not reach Cloudflare. Try again shortly." };
  }
}
