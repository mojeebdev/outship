// GitHub contribution history: what someone did on GitHub over the last year,
// imported at sign-in so a new builder's profile doesn't start blank.
//
// It is context, not score. Score, streak and rank come only from ships that
// GitHub's webhooks verified as they happened (src/lib/score.ts); nothing in
// this file is ever read by scoring.

const DAY_MS = 86_400_000;

/** At most one import per builder per day, however often they sign in. */
export const HISTORY_SYNC_INTERVAL_MS = DAY_MS;

export function shouldSyncHistory(syncedAt: Date | null, now = new Date()): boolean {
  return !syncedAt || now.getTime() - syncedAt.getTime() >= HISTORY_SYNC_INTERVAL_MS;
}

export const CONTRIBUTIONS_QUERY = `query($from: DateTime!, $to: DateTime!) {
  viewer {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

export type HistoryTotals = {
  historyContributions: number;
  historyCommits: number;
  historyPullRequests: number;
  historyReviews: number;
  historyRestricted: number;
};

export type ParsedHistory = { totals: HistoryTotals; days: { date: string; count: number }[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

/** Reads GitHub's GraphQL answer. Null if it isn't the expected shape. */
export function parseContributions(json: unknown): ParsedHistory | null {
  const collection = (json as { data?: { viewer?: { contributionsCollection?: Record<string, unknown> } } })?.data
    ?.viewer?.contributionsCollection;
  if (!collection) return null;
  const calendar = collection.contributionCalendar as
    | { totalContributions?: unknown; weeks?: { contributionDays?: { date?: unknown; contributionCount?: unknown }[] }[] }
    | undefined;
  if (!calendar || !Array.isArray(calendar.weeks)) return null;

  const days: { date: string; count: number }[] = [];
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays ?? []) {
      if (typeof day.date === "string" && DATE.test(day.date) && count(day.contributionCount) > 0) {
        days.push({ date: day.date, count: count(day.contributionCount) });
      }
    }
  }
  return {
    totals: {
      historyContributions: count(calendar.totalContributions),
      historyCommits: count(collection.totalCommitContributions),
      historyPullRequests: count(collection.totalPullRequestContributions),
      historyReviews: count(collection.totalPullRequestReviewContributions),
      historyRestricted: count(collection.restrictedContributionsCount),
    },
    days,
  };
}

/** The last 365 days, ending now: GitHub's own calendar window. */
export function historyWindow(now = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - 365 * DAY_MS).toISOString(), to: now.toISOString() };
}

export async function fetchContributionHistory(accessToken: string, now = new Date()): Promise<ParsedHistory | null> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "outship",
    },
    body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: historyWindow(now) }),
  });
  if (!response.ok) return null;
  return parseContributions(await response.json());
}

/**
 * Replaces a builder's stored history with a fresh import. Runs from the
 * sign-in callback's waitUntil, with the token GitHub gave that sign-in; the
 * token goes no further than this call. Statements go to D1 directly, in one
 * batch, so a year of days is one round trip and stays within D1's bound
 * parameter limit per statement.
 */
export async function importContributionHistory(
  d1: D1Database,
  builderId: string,
  accessToken: string,
  now = new Date(),
): Promise<boolean> {
  const history = await fetchContributionHistory(accessToken, now);
  if (!history) return false;
  const { totals, days } = history;
  await d1.batch([
    d1.prepare(`DELETE FROM "ContributionDay" WHERE "builderId" = ?1`).bind(builderId),
    ...days.map((day) =>
      d1
        .prepare(`INSERT INTO "ContributionDay" ("builderId", "date", "count") VALUES (?1, ?2, ?3)`)
        .bind(builderId, day.date, day.count),
    ),
    d1
      .prepare(
        `UPDATE "Builder" SET "historyContributions" = ?2, "historyCommits" = ?3, "historyPullRequests" = ?4,
           "historyReviews" = ?5, "historyRestricted" = ?6, "historySyncedAt" = ?7 WHERE "id" = ?1`,
      )
      .bind(
        builderId,
        totals.historyContributions,
        totals.historyCommits,
        totals.historyPullRequests,
        totals.historyReviews,
        totals.historyRestricted,
        now.toISOString(),
      ),
  ]);
  return true;
}

// ── the heatmap ──────────────────────────────────────────────────────────────

export const HEATMAP_WEEKS = 53;

export type HeatmapCell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4; week: number; weekday: number };

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Intensity 1–4 by share of the busiest day, so one huge day doesn't wash out the rest. */
export function intensity(value: number, max: number): HeatmapCell["level"] {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((4 * value) / max))) as HeatmapCell["level"];
}

/**
 * A GitHub-style grid: 53 week columns, Sunday to Saturday rows, ending on
 * today's (UTC) week. Days after today aren't returned.
 */
export function heatmapCells(counts: Map<string, number>, now = new Date()): HeatmapCell[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = today - (now.getUTCDay() + (HEATMAP_WEEKS - 1) * 7) * DAY_MS;
  const max = Math.max(0, ...counts.values());
  const cells: HeatmapCell[] = [];
  for (let ms = start, index = 0; ms <= today; ms += DAY_MS, index++) {
    const date = isoDay(ms);
    const value = counts.get(date) ?? 0;
    cells.push({ date, count: value, level: intensity(value, max), week: Math.floor(index / 7), weekday: index % 7 });
  }
  return cells;
}

/** Ship counts per UTC day, for builders with no imported history. */
export function countByDay(dates: Date[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const day = date.toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}
