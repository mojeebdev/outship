// Leaderboards over a window of time: this week, this month, all time. Used
// by /leaderboard, its share cards and /api/leaderboard, so they always agree.
//
// A window's score is shipPoints() over the ships in that window (the same
// daily caps as everywhere), plus the capped streak bonus for all time only:
// a streak is a running thing, not something earned inside a week. Only
// claimed builders take a rank; unclaimed builders are listed, unnumbered;
// hidden builders aren't loaded at all.
import type { getDb } from "@/lib/db";
import { PUBLIC_BUILDER } from "@/lib/builders";
import { capBucket, shipWeight, streakBonus, type ScorableShip } from "@/lib/score";

type Db = Awaited<ReturnType<typeof getDb>>;

export const PERIODS = ["week", "month", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = { week: "this week", month: "this month", all: "all time" };
export const PERIOD_PATHS: Record<Period, string> = {
  week: "/leaderboard",
  month: "/leaderboard/month",
  all: "/leaderboard/all",
};

export const PAGE_SIZE = 50;
export const TOP_LANGUAGES = 8;
export const RISING_MIN_SHIPS = 3;
export const RISING_COUNT = 5;

const DAY_MS = 86_400_000;

/** Monday 00:00 UTC of the week containing `now`, matching the Monday recap. */
export function startOfWeek(now: Date): Date {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(day - sinceMonday * DAY_MS);
}

export function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function periodStart(period: Period, now: Date): Date | null {
  if (period === "week") return startOfWeek(now);
  if (period === "month") return startOfMonth(now);
  return null;
}

export function parsePeriod(value: unknown): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "week";
}

export type LeaderboardShip = ScorableShip & { builderId: string; language: string | null };

export type LeaderboardBuilder = {
  id: string;
  githubId: number;
  githubLogin: string;
  currentStreak: number;
  claimedAt: Date | null;
};

export type LeaderboardRow = {
  githubId: number;
  githubLogin: string;
  claimed: boolean;
  /** Among claimed builders only; null for unclaimed ones. */
  rank: number | null;
  score: number;
  ships: number;
  currentStreak: number;
  /** When the builder's points in this window last went up. */
  reachedAt: Date | null;
};

/**
 * Points from ships, plus the moment they reached that total. Ships are
 * replayed in time order; each one either raises its day's capped total or
 * doesn't (it's past the cap, below the ships already counting). The last
 * raise is when the builder "reached" their score, which breaks ties.
 */
export function pointsWithReachedAt(ships: ScorableShip[]): { points: number; reachedAt: Date | null } {
  const buckets = new Map<string, number[]>();
  let points = 0;
  let reachedAt: Date | null = null;
  const ordered = [...ships].sort((a, b) => a.shippedAt.getTime() - b.shippedAt.getTime());
  for (const ship of ordered) {
    const { key, cap } = capBucket(ship);
    const weights = buckets.get(key) ?? [];
    const before = topSum(weights, cap);
    weights.push(shipWeight(ship));
    weights.sort((a, b) => b - a);
    buckets.set(key, weights);
    const gained = topSum(weights, cap) - before;
    if (gained > 0) {
      points += gained;
      reachedAt = ship.shippedAt;
    }
  }
  return { points, reachedAt };
}

function topSum(sortedDesc: number[], cap: number): number {
  let sum = 0;
  for (let i = 0; i < Math.min(cap, sortedDesc.length); i++) sum += sortedDesc[i];
  return sum;
}

/**
 * The ordered board. Ties go to whoever reached the score first, then to
 * login. `includeStreak` adds the capped streak bonus (all time, no language
 * filter); windows without it list only builders who shipped in them.
 */
export function rankBuilders(
  builders: LeaderboardBuilder[],
  ships: LeaderboardShip[],
  { includeStreak }: { includeStreak: boolean },
): LeaderboardRow[] {
  const byBuilder = new Map<string, LeaderboardShip[]>();
  for (const ship of ships) {
    const list = byBuilder.get(ship.builderId);
    if (list) list.push(ship);
    else byBuilder.set(ship.builderId, [ship]);
  }

  const rows: LeaderboardRow[] = [];
  for (const builder of builders) {
    const own = byBuilder.get(builder.id) ?? [];
    if (!includeStreak && own.length === 0) continue;
    const { points, reachedAt } = pointsWithReachedAt(own);
    const score = points + (includeStreak ? streakBonus(builder.currentStreak) : 0);
    if (includeStreak && own.length === 0 && score === 0) continue;
    rows.push({
      githubId: builder.githubId,
      githubLogin: builder.githubLogin,
      claimed: builder.claimedAt !== null,
      rank: null,
      score,
      ships: own.length,
      currentStreak: builder.currentStreak,
      reachedAt,
    });
  }

  const reached = (row: LeaderboardRow) => row.reachedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  rows.sort(
    (a, b) => b.score - a.score || reached(a) - reached(b) || a.githubLogin.localeCompare(b.githubLogin),
  );
  let rank = 0;
  for (const row of rows) if (row.claimed) row.rank = ++rank;
  return rows;
}

/** The languages with the most ships, most first. */
export function topLanguages(ships: { language: string | null }[], limit = TOP_LANGUAGES): string[] {
  const counts = new Map<string, number>();
  for (const ship of ships) if (ship.language) counts.set(ship.language, (counts.get(ship.language) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([language]) => language);
}

export type RisingRow = { githubId: number; githubLogin: string; claimed: boolean; gain: number; thisWeek: number; ships: number };

/**
 * Biggest gains this week over last week (Monday to Monday), among builders
 * with at least RISING_MIN_SHIPS ships this week, so one lucky release isn't
 * "rising".
 */
export function risingBuilders(
  builders: LeaderboardBuilder[],
  ships: LeaderboardShip[],
  now: Date,
  limit = RISING_COUNT,
): RisingRow[] {
  const thisWeekStart = startOfWeek(now).getTime();
  const lastWeekStart = thisWeekStart - 7 * DAY_MS;
  const thisWeek = new Map<string, LeaderboardShip[]>();
  const lastWeek = new Map<string, LeaderboardShip[]>();
  for (const ship of ships) {
    const time = ship.shippedAt.getTime();
    const bucket = time >= thisWeekStart ? thisWeek : time >= lastWeekStart ? lastWeek : null;
    if (!bucket) continue;
    const list = bucket.get(ship.builderId);
    if (list) list.push(ship);
    else bucket.set(ship.builderId, [ship]);
  }

  const rows: RisingRow[] = [];
  for (const builder of builders) {
    const current = thisWeek.get(builder.id) ?? [];
    if (current.length < RISING_MIN_SHIPS) continue;
    const now_ = pointsWithReachedAt(current).points;
    const before = pointsWithReachedAt(lastWeek.get(builder.id) ?? []).points;
    if (now_ - before <= 0) continue;
    rows.push({
      githubId: builder.githubId,
      githubLogin: builder.githubLogin,
      claimed: builder.claimedAt !== null,
      gain: now_ - before,
      thisWeek: now_,
      ships: current.length,
    });
  }
  return rows
    .sort((a, b) => b.gain - a.gain || b.thisWeek - a.thisWeek || a.githubLogin.localeCompare(b.githubLogin))
    .slice(0, limit);
}

// ── loading ──────────────────────────────────────────────────────────────────

const SHIP_SELECT = {
  builderId: true,
  shipType: true,
  shippedAt: true,
  weightClass: true,
  releaseHasNotes: true,
  source: true,
  language: true,
} as const;

const BUILDER_SELECT = { id: true, githubId: true, githubLogin: true, currentStreak: true, claimedAt: true } as const;

async function loadShips(db: Db, since: Date | null): Promise<LeaderboardShip[]> {
  return db.ship.findMany({
    where: { builder: PUBLIC_BUILDER, ...(since ? { shippedAt: { gte: since } } : {}) },
    select: SHIP_SELECT,
  });
}

export type Leaderboard = {
  period: Period;
  language: string | null;
  languages: string[];
  page: number;
  pageCount: number;
  total: number;
  rows: LeaderboardRow[];
};

export async function loadLeaderboard(
  db: Db,
  { period, language, page }: { period: Period; language?: string | null; page?: number },
  now = new Date(),
): Promise<Leaderboard> {
  const [builders, windowShips] = await Promise.all([
    db.builder.findMany({ where: PUBLIC_BUILDER, select: BUILDER_SELECT }),
    loadShips(db, periodStart(period, now)),
  ]);
  const languages = topLanguages(windowShips);
  const chosen = language && languages.includes(language) ? language : null;
  const ships = chosen ? windowShips.filter((ship) => ship.language === chosen) : windowShips;
  // A language board is about ships in that language; a streak isn't.
  const all = rankBuilders(builders, ships, { includeStreak: period === "all" && !chosen });

  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(page ?? 1)), pageCount);
  return {
    period,
    language: chosen,
    languages,
    page: current,
    pageCount,
    total: all.length,
    rows: all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
  };
}

export async function loadRising(db: Db, now = new Date()): Promise<RisingRow[]> {
  const since = new Date(startOfWeek(now).getTime() - 7 * DAY_MS);
  const [builders, ships] = await Promise.all([
    db.builder.findMany({ where: PUBLIC_BUILDER, select: BUILDER_SELECT }),
    loadShips(db, since),
  ]);
  return risingBuilders(builders, ships, now);
}

/**
 * A builder's place on a board, exactly as the leaderboard would number it,
 * or null if they're unclaimed, hidden or not on it.
 *
 * All time reads only what it must: builders with a higher stored score are
 * counted, and only builders tied on score have their ships replayed for the
 * tie-break. A window reads that window's ships, which are few.
 */
export async function rankIn(
  db: Db,
  period: Period,
  builder: { id: string; githubLogin: string; score: number; claimedAt: Date | null; hidden: boolean },
  now = new Date(),
): Promise<number | null> {
  if (builder.claimedAt === null || builder.hidden) return null;

  if (period !== "all") {
    const [builders, ships] = await Promise.all([
      db.builder.findMany({ where: PUBLIC_BUILDER, select: BUILDER_SELECT }),
      loadShips(db, periodStart(period, now)),
    ]);
    return rankBuilders(builders, ships, { includeStreak: false }).find((row) => row.githubLogin === builder.githubLogin)?.rank ?? null;
  }

  const ranked = { ...PUBLIC_BUILDER, claimedAt: { not: null } };
  const [above, tied] = await Promise.all([
    db.builder.count({ where: { ...ranked, score: { gt: builder.score } } }),
    db.builder.findMany({ where: { ...ranked, score: builder.score }, select: BUILDER_SELECT }),
  ]);
  if (tied.length <= 1) return above + 1;
  const tiedShips = await db.ship.findMany({ where: { builderId: { in: tied.map((row) => row.id) } }, select: SHIP_SELECT });
  const order = rankBuilders(tied, tiedShips, { includeStreak: true });
  const position = order.findIndex((row) => row.githubLogin === builder.githubLogin);
  return above + (position === -1 ? tied.length : position + 1);
}
