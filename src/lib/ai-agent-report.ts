/**
 * Admin report of AI crawler/assistant/agent requests (docs/ai-recommendation-playbook.md, step 1).
 *
 * Reads the Workers Analytics Engine dataset written by cloudflare/aiAgentLog.ts through Cloudflare's SQL API.
 * Reuses the admin traffic credentials: CLOUDFLARE_ACCOUNT_ID (wrangler.jsonc) and the CLOUDFLARE_ANALYTICS_TOKEN
 * secret (Account Analytics: Read). When they are missing, or the query fails, the report says so instead of showing
 * zeros: a measured zero and "not measured" are different things.
 */

export const AI_AGENT_DATASET = "outship_ai_agents";

/** Analytics Engine keeps three months; longer ranges are capped to that. */
const RANGE_HOURS: Record<string, number> = {
  "12h": 12,
  "24h": 24,
  this_week: 24 * 7,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
  all: 24 * 90,
};

export function rangeHours(range: string | null | undefined): number {
  return RANGE_HOURS[range ?? ""] ?? RANGE_HOURS["7d"];
}

export type AiAgentRow = {
  agent: string;
  operator: string;
  category: string;
  path: string;
  format: string;
  status: number;
  acceptMarkdown: boolean;
  hits: number;
};

export type AiAgentReport =
  | {
      configured: true;
      hours: number;
      total: number;
      byCategory: Array<{ category: string; hits: number }>;
      byAgent: Array<{ agent: string; operator: string; category: string; hits: number; markdownShare: number }>;
      topPaths: Array<{ path: string; hits: number; agents: number }>;
      statuses: Array<{ status: number; hits: number }>;
      askedForMarkdown: number;
      servedMarkdown: number;
    }
  | { configured: false; reason: string };

export function buildQuery(hours: number): string {
  const safeHours = Math.max(1, Math.min(24 * 90, Math.floor(hours)));
  return `SELECT blob1 AS agent, blob2 AS operator, blob3 AS category, blob4 AS path, blob5 AS format,
    double1 AS status, blob7 AS accept, SUM(_sample_interval) AS hits
    FROM ${AI_AGENT_DATASET}
    WHERE timestamp > NOW() - INTERVAL '${safeHours}' HOUR
    GROUP BY agent, operator, category, path, format, status, accept
    ORDER BY hits DESC
    LIMIT 5000`;
}

/** Pure aggregation, so it can be tested without Cloudflare. */
export function summarize(rows: AiAgentRow[], hours: number): Extract<AiAgentReport, { configured: true }> {
  const sum = <K extends string>(key: (row: AiAgentRow) => K) => {
    const totals = new Map<K, number>();
    for (const row of rows) totals.set(key(row), (totals.get(key(row)) ?? 0) + row.hits);
    return totals;
  };
  const byDesc = <T extends { hits: number }>(a: T, b: T) => b.hits - a.hits;

  const agentTotals = new Map<string, { agent: string; operator: string; category: string; hits: number; markdown: number }>();
  for (const row of rows) {
    const key = `${row.agent}\u0000${row.category}`;
    const entry = agentTotals.get(key) ?? { agent: row.agent, operator: row.operator, category: row.category, hits: 0, markdown: 0 };
    entry.hits += row.hits;
    if (row.format === "markdown") entry.markdown += row.hits;
    agentTotals.set(key, entry);
  }

  const pathAgents = new Map<string, Set<string>>();
  for (const row of rows) {
    const agents = pathAgents.get(row.path) ?? new Set<string>();
    agents.add(row.agent);
    pathAgents.set(row.path, agents);
  }

  return {
    configured: true,
    hours,
    total: rows.reduce((acc, row) => acc + row.hits, 0),
    byCategory: [...sum((row) => row.category)].map(([category, hits]) => ({ category, hits })).sort(byDesc),
    byAgent: [...agentTotals.values()]
      .map(({ markdown, ...entry }) => ({ ...entry, markdownShare: entry.hits ? markdown / entry.hits : 0 }))
      .sort(byDesc),
    topPaths: [...sum((row) => row.path)]
      .map(([path, hits]) => ({ path, hits, agents: pathAgents.get(path)?.size ?? 0 }))
      .sort(byDesc)
      .slice(0, 25),
    statuses: [...sum((row) => String(row.status) as `${number}`)]
      .map(([status, hits]) => ({ status: Number(status), hits }))
      .sort(byDesc),
    askedForMarkdown: rows.filter((row) => row.acceptMarkdown).reduce((acc, row) => acc + row.hits, 0),
    servedMarkdown: rows.filter((row) => row.format === "markdown").reduce((acc, row) => acc + row.hits, 0),
  };
}

type SqlRow = Record<string, unknown>;

function toRow(raw: SqlRow): AiAgentRow {
  return {
    agent: String(raw.agent ?? ""),
    operator: String(raw.operator ?? ""),
    category: String(raw.category ?? ""),
    path: String(raw.path ?? ""),
    format: String(raw.format ?? ""),
    status: Number(raw.status ?? 0),
    acceptMarkdown: raw.accept === "accept-markdown",
    hits: Number(raw.hits ?? 0),
  };
}

export async function loadAiAgentReport(
  range: string | number | null,
  env: { accountId?: string; token?: string },
  fetcher: typeof fetch = fetch,
): Promise<AiAgentReport> {
  if (!env.accountId || !env.token) {
    return {
      configured: false,
      reason:
        "Not measured yet: the CLOUDFLARE_ANALYTICS_TOKEN secret (Account Analytics: Read) is needed, the same one as traffic above.",
    };
  }
  const hours = typeof range === "number" ? Math.max(1, Math.min(24 * 90, Math.ceil(range))) : rangeHours(range);
  try {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/analytics_engine/sql`,
      { method: "POST", headers: { Authorization: `Bearer ${env.token}` }, body: buildQuery(hours) },
    );
    if (!response.ok) {
      return { configured: false, reason: `Cloudflare returned ${response.status} for the AI agent query. Check the token's permission and the account ID.` };
    }
    const payload = (await response.json()) as { data?: SqlRow[] };
    return summarize((payload.data ?? []).map(toRow), hours);
  } catch {
    return { configured: false, reason: "The AI agent query could not reach Cloudflare. Try again shortly." };
  }
}
