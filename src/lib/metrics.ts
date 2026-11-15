// Every number the admin panel and /stats show, computed from outship's own
// tables as SQL aggregates. Nothing here is sampled or estimated.
//
// Dates are compared through julianday(): rows written by Prisma, by raw SQL
// and by column defaults store slightly different timestamp formats, and
// julianday() reads them all the same way.
import { shipPoints, type WeightClass } from "@/lib/score";
import { TIERS, tierFor } from "@/lib/tiers";

export const WINDOWS = {
  "30m": { label: "30 minutes", ms: 30 * 60_000, bucketMs: 60_000 },
  "1h": { label: "1 hour", ms: 3_600_000, bucketMs: 2 * 60_000 },
  "8h": { label: "8 hours", ms: 8 * 3_600_000, bucketMs: 15 * 60_000 },
  "12h": { label: "12 hours", ms: 12 * 3_600_000, bucketMs: 30 * 60_000 },
  "24h": { label: "24 hours", ms: 86_400_000, bucketMs: 3_600_000 },
  "7d": { label: "7 days", ms: 7 * 86_400_000, bucketMs: 6 * 3_600_000 },
  "30d": { label: "30 days", ms: 30 * 86_400_000, bucketMs: 86_400_000 },
  "12mo": { label: "12 months", ms: 365 * 86_400_000, bucketMs: 7 * 86_400_000 },
} as const;

export type WindowKey = keyof typeof WINDOWS;

export function parseWindow(value: unknown): WindowKey {
  return typeof value === "string" && value in WINDOWS ? (value as WindowKey) : "24h";
}

export type Range = { start: Date; end: Date };

export function windowRanges(key: WindowKey, now = new Date()): { current: Range; previous: Range } {
  const { ms } = WINDOWS[key];
  const start = new Date(now.getTime() - ms);
  return { current: { start, end: now }, previous: { start: new Date(start.getTime() - ms), end: start } };
}

/** Change against the previous window, as a fraction; null when there's nothing to compare with. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

const num = (value: unknown) => Number(value ?? 0);

// ── counts in a window ───────────────────────────────────────────────────────

/** Counted events: [label, table, time column, extra SQL condition]. */
const EVENT_COUNTS = {
  ships: [`"Ship"`, `"shippedAt"`, ``],
  releases: [`"Ship"`, `"shippedAt"`, `AND "shipType" = 'RELEASE'`],
  merges: [`"Ship"`, `"shippedAt"`, `AND "shipType" = 'MERGE'`],
  pushes: [`"Ship"`, `"shippedAt"`, `AND "shipType" = 'PUSH'`],
  imported: [`"Ship"`, `"createdAt"`, `AND "source" = 'BACKFILL'`],
  newBuilders: [`"Builder"`, `"createdAt"`, ``],
  claims: [`"Builder"`, `"claimedAt"`, ``],
  signIns: [`"SignInEvent"`, `"at"`, ``],
  invites: [`"Builder"`, `"claimInvitedAt"`, ``],
  installs: [`"Installation"`, `"createdAt"`, ``],
  uninstalls: [`"Installation"`, `"deletedAt"`, ``],
  attestations: [`"Attestation"`, `"attestedAt"`, ``],
  verifiedAttestations: [`"Attestation"`, `"attestedAt"`, `AND "schemaVersion" >= 2`],
  recapSignups: [`"Subscriber"`, `"createdAt"`, ``],
  recapConfirmed: [`"Subscriber"`, `"confirmedAt"`, ``],
  recapUnsubscribed: [`"Subscriber"`, `"unsubscribedAt"`, ``],
} as const;

export type EventKey = keyof typeof EVENT_COUNTS;
export type Counts = Record<EventKey | "activeBuilders" | "signedInBuilders" | "points", number>;

function countSql(key: EventKey, startParam: string, endParam: string): string {
  const [table, column, extra] = EVENT_COUNTS[key];
  return `(SELECT COUNT(*) FROM ${table} WHERE ${column} IS NOT NULL
             AND julianday(${column}) >= julianday(${startParam}) AND julianday(${column}) < julianday(${endParam}) ${extra}) AS "${key}"`;
}

/** Every event count for a window, in one query, plus actives and points. */
export async function windowCounts(d1: D1Database, range: Range): Promise<Counts> {
  const selects = (Object.keys(EVENT_COUNTS) as EventKey[]).map((key) => countSql(key, "?1", "?2"));
  selects.push(`(SELECT COUNT(DISTINCT "builderId") FROM "Ship"
                  WHERE julianday("shippedAt") >= julianday(?1) AND julianday("shippedAt") < julianday(?2)) AS "activeBuilders"`);
  selects.push(`(SELECT COUNT(DISTINCT "builderId") FROM "SignInEvent"
                  WHERE julianday("at") >= julianday(?1) AND julianday("at") < julianday(?2)) AS "signedInBuilders"`);
  const start = range.start.toISOString();
  const end = range.end.toISOString();
  const [row, ships] = await Promise.all([
    d1.prepare(`SELECT ${selects.join(",\n")}`).bind(start, end).first<Record<string, unknown>>(),
    d1
      .prepare(
        `SELECT "builderId", "shipType", "shippedAt", "weightClass", "releaseHasNotes" FROM "Ship"
          WHERE julianday("shippedAt") >= julianday(?1) AND julianday("shippedAt") < julianday(?2)`,
      )
      .bind(start, end)
      .all<{
        builderId: string;
        shipType: "RELEASE" | "MERGE" | "PUSH";
        shippedAt: string;
        weightClass: WeightClass;
        releaseHasNotes: number | null;
      }>(),
  ]);
  const counts = Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key, num(value)])) as Counts;
  // Points earned in the window: each builder's ships scored with their own
  // daily caps, exactly as scoring does, then summed.
  const byBuilder = new Map<string, Parameters<typeof shipPoints>[0]>();
  for (const ship of ships.results) {
    const list = byBuilder.get(ship.builderId) ?? [];
    list.push({
      shipType: ship.shipType,
      shippedAt: new Date(ship.shippedAt),
      weightClass: ship.weightClass,
      releaseHasNotes: ship.releaseHasNotes === null ? null : Boolean(ship.releaseHasNotes),
    });
    byBuilder.set(ship.builderId, list);
  }
  counts.points = [...byBuilder.values()].reduce((sum, list) => sum + shipPoints(list), 0);
  return counts;
}

// ── totals ───────────────────────────────────────────────────────────────────

export type Totals = {
  builders: number;
  claimed: number;
  unclaimed: number;
  hidden: number;
  ships: number;
  publicShips: number;
  importedShips: number;
  repos: number;
  attestations: number;
  verifiedAttestations: number;
  wallets: number;
  liveInstalls: number;
  recapConfirmed: number;
  invited: number;
  claimedAfterInvite: number;
  thirtyDayClub: number;
  apiKeys: number;
  backfill: { pending: number; done: number; failed: number };
};

export async function totals(d1: D1Database): Promise<Totals> {
  const row = await d1
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM "Builder") AS builders,
        (SELECT COUNT(*) FROM "Builder" WHERE "claimedAt" IS NOT NULL) AS claimed,
        (SELECT COUNT(*) FROM "Builder" WHERE "hidden" = 1) AS hidden,
        (SELECT COUNT(*) FROM "Ship") AS ships,
        (SELECT COUNT(*) FROM "Ship" WHERE "isPrivate" = 0) AS publicShips,
        (SELECT COUNT(*) FROM "Ship" WHERE "source" = 'BACKFILL') AS importedShips,
        (SELECT COUNT(DISTINCT "repo") FROM "Ship") AS repos,
        (SELECT COUNT(*) FROM "Attestation") AS attestations,
        (SELECT COUNT(*) FROM "Attestation" WHERE "schemaVersion" >= 2) AS verifiedAttestations,
        (SELECT COUNT(*) FROM "Builder" WHERE "walletAddress" IS NOT NULL) AS wallets,
        (SELECT COUNT(*) FROM "Installation" WHERE "deletedAt" IS NULL) AS liveInstalls,
        (SELECT COUNT(*) FROM "Subscriber" WHERE "status" = 'CONFIRMED') AS recapConfirmed,
        (SELECT COUNT(*) FROM "Builder" WHERE "claimInvitedAt" IS NOT NULL) AS invited,
        (SELECT COUNT(*) FROM "Builder" WHERE "claimInvitedAt" IS NOT NULL
            AND "claimedAt" IS NOT NULL AND julianday("claimedAt") >= julianday("claimInvitedAt")) AS claimedAfterInvite,
        (SELECT COUNT(*) FROM "Builder" WHERE "currentStreak" >= 30) AS thirtyDayClub,
        (SELECT COUNT(*) FROM "ApiKey" WHERE "revokedAt" IS NULL) AS apiKeys,
        (SELECT COUNT(*) FROM "BackfillJob" WHERE "status" = 'PENDING') AS backfillPending,
        (SELECT COUNT(*) FROM "BackfillJob" WHERE "status" = 'DONE') AS backfillDone,
        (SELECT COUNT(*) FROM "BackfillJob" WHERE "status" = 'FAILED') AS backfillFailed`,
    )
    .first<Record<string, unknown>>();
  const r = Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key, num(value)]));
  return {
    builders: r.builders,
    claimed: r.claimed,
    unclaimed: r.builders - r.claimed,
    hidden: r.hidden,
    ships: r.ships,
    publicShips: r.publicShips,
    importedShips: r.importedShips,
    repos: r.repos,
    attestations: r.attestations,
    verifiedAttestations: r.verifiedAttestations,
    wallets: r.wallets,
    liveInstalls: r.liveInstalls,
    recapConfirmed: r.recapConfirmed,
    invited: r.invited,
    claimedAfterInvite: r.claimedAfterInvite,
    thirtyDayClub: r.thirtyDayClub,
    apiKeys: r.apiKeys,
    backfill: { pending: r.backfillPending, done: r.backfillDone, failed: r.backfillFailed },
  };
}

// ── time series ──────────────────────────────────────────────────────────────

export const SERIES = {
  ships: [`"Ship"`, `"shippedAt"`, `COUNT(*)`],
  activeBuilders: [`"Ship"`, `"shippedAt"`, `COUNT(DISTINCT "builderId")`],
  signIns: [`"SignInEvent"`, `"at"`, `COUNT(*)`],
  newBuilders: [`"Builder"`, `"createdAt"`, `COUNT(*)`],
  attestations: [`"Attestation"`, `"attestedAt"`, `COUNT(*)`],
} as const;

export type SeriesKey = keyof typeof SERIES;
export type Bucket = { start: Date; value: number };

/** Fills empty buckets with zero, so a chart shows quiet periods as quiet. */
export function fillBuckets(range: Range, bucketMs: number, rows: { b: number; v: number }[]): Bucket[] {
  const count = Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / bucketMs));
  const values = new Map(rows.map((row) => [Number(row.b), Number(row.v)]));
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(range.start.getTime() + i * bucketMs),
    value: values.get(i) ?? 0,
  }));
}

export async function series(d1: D1Database, key: SeriesKey, range: Range, bucketMs: number): Promise<Bucket[]> {
  const [table, column, aggregate] = SERIES[key];
  const { results } = await d1
    .prepare(
      `SELECT CAST((julianday(${column}) - julianday(?1)) * 86400000 / ?3 AS INTEGER) AS b, ${aggregate} AS v
         FROM ${table}
        WHERE ${column} IS NOT NULL AND julianday(${column}) >= julianday(?1) AND julianday(${column}) < julianday(?2)
        GROUP BY b ORDER BY b`,
    )
    .bind(range.start.toISOString(), range.end.toISOString(), bucketMs)
    .all<{ b: number; v: number }>();
  return fillBuckets(range, bucketMs, results);
}

// ── breakdowns ───────────────────────────────────────────────────────────────

/** Ships by UTC weekday (0 = Sunday) and hour, for the "when do people ship" heatmap. */
export async function weekHourGrid(d1: D1Database, range: Range): Promise<number[][]> {
  const { results } = await d1
    .prepare(
      `SELECT CAST(strftime('%w', "shippedAt") AS INTEGER) AS d, CAST(strftime('%H', "shippedAt") AS INTEGER) AS h, COUNT(*) AS v
         FROM "Ship" WHERE julianday("shippedAt") >= julianday(?1) AND julianday("shippedAt") < julianday(?2)
        GROUP BY d, h`,
    )
    .bind(range.start.toISOString(), range.end.toISOString())
    .all<{ d: number; h: number; v: number }>();
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const row of results) if (row.d >= 0 && row.d < 7 && row.h >= 0 && row.h < 24) grid[row.d][row.h] = Number(row.v);
  return grid;
}

/** Ship counts per UTC day over the last year, for the calendar heatmap. */
export async function shipsPerDay(d1: D1Database, now = new Date()): Promise<Map<string, number>> {
  const { results } = await d1
    .prepare(
      `SELECT date("shippedAt") AS day, COUNT(*) AS v FROM "Ship"
        WHERE julianday("shippedAt") >= julianday(?1) GROUP BY day`,
    )
    .bind(new Date(now.getTime() - 371 * 86_400_000).toISOString())
    .all<{ day: string; v: number }>();
  return new Map(results.map((row) => [row.day, Number(row.v)]));
}

export type Ranked = { label: string; value: number };

export async function topLanguages(d1: D1Database, range: Range, limit = 8): Promise<Ranked[]> {
  const { results } = await d1
    .prepare(
      `SELECT "language" AS label, COUNT(*) AS value FROM "Ship"
        WHERE "language" IS NOT NULL AND julianday("shippedAt") >= julianday(?1) AND julianday("shippedAt") < julianday(?2)
        GROUP BY "language" ORDER BY value DESC, label LIMIT ?3`,
    )
    .bind(range.start.toISOString(), range.end.toISOString(), limit)
    .all<Ranked>();
  return results.map((row) => ({ label: row.label, value: Number(row.value) }));
}

/** Busiest public repos. Private repos are summed into one line, unnamed. */
export async function topRepos(d1: D1Database, range: Range, limit = 8): Promise<Ranked[]> {
  const bind = [range.start.toISOString(), range.end.toISOString()];
  const [named, hidden] = await Promise.all([
    d1
      .prepare(
        `SELECT "repo" AS label, COUNT(*) AS value FROM "Ship"
          WHERE "isPrivate" = 0 AND julianday("shippedAt") >= julianday(?1) AND julianday("shippedAt") < julianday(?2)
          GROUP BY "repo" ORDER BY value DESC, label LIMIT ?3`,
      )
      .bind(...bind, limit)
      .all<Ranked>(),
    d1
      .prepare(
        `SELECT COUNT(*) AS value FROM "Ship"
          WHERE "isPrivate" = 1 AND julianday("shippedAt") >= julianday(?1) AND julianday("shippedAt") < julianday(?2)`,
      )
      .bind(...bind)
      .first<{ value: number }>(),
  ]);
  const rows = named.results.map((row) => ({ label: row.label, value: Number(row.value) }));
  const privateCount = Number(hidden?.value ?? 0);
  return privateCount > 0 ? [...rows, { label: "private repos (all)", value: privateCount }] : rows;
}

export const STREAK_BUCKETS = [
  { label: "none", min: 0, max: 0 },
  { label: "1–2 days", min: 1, max: 2 },
  { label: "3–6 days", min: 3, max: 6 },
  { label: "7–13 days", min: 7, max: 13 },
  { label: "14–29 days", min: 14, max: 29 },
  { label: "30+ days", min: 30, max: Number.MAX_SAFE_INTEGER },
] as const;

export async function distributions(d1: D1Database): Promise<{ streaks: Ranked[]; tiers: Ranked[] }> {
  const { results } = await d1
    .prepare(`SELECT "currentStreak" AS streak, "score" FROM "Builder" WHERE "hidden" = 0`)
    .all<{ streak: number; score: number }>();
  const streaks = STREAK_BUCKETS.map((bucket) => ({
    label: bucket.label,
    value: results.filter((row) => row.streak >= bucket.min && row.streak <= bucket.max).length,
  }));
  const tiers = TIERS.map((tier) => ({
    label: tier.name,
    value: results.filter((row) => tierFor(Number(row.score)).tier.name === tier.name).length,
  }));
  return { streaks, tiers };
}

// ── cohorts ──────────────────────────────────────────────────────────────────

export type Cohort = { week: Date; size: number; retained: (number | null)[] };

const WEEK_MS = 7 * 86_400_000;

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(day - ((date.getUTCDay() + 6) % 7) * 86_400_000);
}

/**
 * Weekly retention: builders grouped by the week they first signed in; for
 * each following week, the share who shipped at least once. Pure, so the
 * maths is tested on its own.
 */
export function cohortTable(
  joins: { builderId: string; joinedAt: Date }[],
  ships: { builderId: string; shippedAt: Date }[],
  weeks: number,
  now = new Date(),
): Cohort[] {
  const thisWeek = weekStart(now).getTime();
  const firstWeek = thisWeek - (weeks - 1) * WEEK_MS;
  const shipWeeks = new Map<string, Set<number>>();
  for (const ship of ships) {
    const week = weekStart(ship.shippedAt).getTime();
    const set = shipWeeks.get(ship.builderId) ?? new Set<number>();
    set.add(week);
    shipWeeks.set(ship.builderId, set);
  }
  const cohorts: Cohort[] = [];
  for (let week = firstWeek; week <= thisWeek; week += WEEK_MS) {
    const members = joins.filter((join) => weekStart(join.joinedAt).getTime() === week).map((join) => join.builderId);
    const retained: (number | null)[] = [];
    for (let offset = 0; offset < weeks; offset++) {
      const target = week + offset * WEEK_MS;
      if (target > thisWeek) {
        retained.push(null);
        continue;
      }
      const active = members.filter((id) => shipWeeks.get(id)?.has(target)).length;
      retained.push(members.length ? active / members.length : null);
    }
    cohorts.push({ week: new Date(week), size: members.length, retained });
  }
  return cohorts;
}

export async function cohorts(d1: D1Database, weeks = 8, now = new Date()): Promise<Cohort[]> {
  const since = new Date(weekStart(now).getTime() - (weeks - 1) * WEEK_MS).toISOString();
  const [joins, ships] = await Promise.all([
    d1
      .prepare(`SELECT "id" AS builderId, "claimedAt" AS joinedAt FROM "Builder" WHERE "claimedAt" IS NOT NULL AND julianday("claimedAt") >= julianday(?1)`)
      .bind(since)
      .all<{ builderId: string; joinedAt: string }>(),
    d1
      .prepare(`SELECT "builderId", "shippedAt" FROM "Ship" WHERE julianday("shippedAt") >= julianday(?1)`)
      .bind(since)
      .all<{ builderId: string; shippedAt: string }>(),
  ]);
  return cohortTable(
    joins.results.map((row) => ({ builderId: row.builderId, joinedAt: new Date(row.joinedAt) })),
    ships.results.map((row) => ({ builderId: row.builderId, shippedAt: new Date(row.shippedAt) })),
    weeks,
    now,
  );
}

// ── API usage ────────────────────────────────────────────────────────────────

export type ApiKeyRow = {
  id: string;
  name: string;
  owner: string;
  prefix: string;
  ratePerMinute: number;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  requests30d: number;
};

export async function apiUsage(d1: D1Database, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const [keys, totalsRow] = await Promise.all([
    d1
      .prepare(
        `SELECT k."id", k."name", k."owner", k."prefix", k."ratePerMinute", k."createdAt", k."lastUsedAt", k."revokedAt",
                COALESCE((SELECT SUM(u."count") FROM "ApiUsage" u WHERE u."keyId" = k."id" AND u."day" >= ?1), 0) AS requests30d
           FROM "ApiKey" k ORDER BY k."revokedAt" IS NOT NULL, requests30d DESC, k."createdAt" DESC`,
      )
      .bind(since)
      .all<ApiKeyRow>(),
    d1
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN "day" = ?2 THEN "count" END), 0) AS today,
                COALESCE(SUM("count"), 0) AS last30,
                COALESCE(SUM(CASE WHEN "keyId" = 'anonymous' THEN "count" END), 0) AS anonymous30
           FROM "ApiUsage" WHERE "day" >= ?1`,
      )
      .bind(since, today)
      .first<{ today: number; last30: number; anonymous30: number }>(),
  ]);
  return {
    keys: keys.results.map((key) => ({ ...key, requests30d: Number(key.requests30d) })),
    today: Number(totalsRow?.today ?? 0),
    last30: Number(totalsRow?.last30 ?? 0),
    anonymous30: Number(totalsRow?.anonymous30 ?? 0),
  };
}
