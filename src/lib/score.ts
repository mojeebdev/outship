// Scoring: the single source of truth. Every number here is imported by the
// copy that explains it (leaderboard, FAQ, ships grid, emails, README is
// checked by hand), so the rules and the words can't drift apart.
//
// Scoring is a pure function of stored ships: everything it needs (type,
// time, weight class, whether a release had notes) is recorded on the Ship
// when the webhook arrives, so any builder can be rescored from the database
// alone (scripts/rescore-all.mjs) and gets the same answer every time.

// Points are scaled for bragging: big enough to feel like a climb, while the
// ratios between kinds of ship stay what they were.
/** A release with notes or at least one asset: something was actually shipped. */
export const RELEASE_POINTS = 50;
/** A release with an empty body and no assets: a bare tag. */
export const BARE_RELEASE_POINTS = 20;
/** A pull request its own author merged, in their own repo. */
export const MERGE_POINTS = 20;
/** A pull request someone else merged, or an outside contribution. */
export const REVIEWED_MERGE_POINTS = 30;
/** A push to the default branch, once a day. */
export const PUSH_POINTS = 10;

/** Bonus per day of the current streak... */
export const STREAK_POINTS_PER_DAY = 10;
/** ...counted for at most this many days, so a streak can't outweigh shipping. */
export const STREAK_CAP = 30;

/** The score bonus a streak of this length is worth. */
export function streakBonus(currentStreak: number): number {
  return STREAK_POINTS_PER_DAY * Math.min(Math.max(0, currentStreak), STREAK_CAP);
}

// How many ships of each type can score per builder per UTC day. Ships past
// the cap are still recorded and shown; they just don't add points, so a
// script publishing empty releases or self-merging PRs can't farm the board.
// Per builder rather than per repo, so spinning up more repos doesn't help.
// When a day has more than the cap, the highest-scoring ones count.
export const DAILY_CAPS = { RELEASE: 2, MERGE: 5, PUSH: 1 } as const;

/**
 * Past commits imported from before a builder installed outship score as
 * pushes, up to this many a day. Live pushes stay at one a day: this only
 * applies to history, which has no push events to go by, only commits.
 */
export const PAST_COMMITS_PER_DAY = 5;

/** The most a builder can earn from live ships in one UTC day. */
export const MAX_DAILY_POINTS =
  RELEASE_POINTS * DAILY_CAPS.RELEASE + REVIEWED_MERGE_POINTS * DAILY_CAPS.MERGE + PUSH_POINTS * DAILY_CAPS.PUSH;

export type ShipType = keyof typeof DAILY_CAPS;
export type WeightClass = "STANDARD" | "REVIEWED" | "EXTERNAL";

export type ScorableShip = {
  shipType: ShipType;
  shippedAt: Date;
  /** MERGE only; anything else is STANDARD. Missing means STANDARD. */
  weightClass?: WeightClass | null;
  /** RELEASE only. null: recorded before outship looked (counted as a full release). */
  releaseHasNotes?: boolean | null;
  /** "BACKFILL" for ships imported from history. Missing means live. */
  source?: string | null;
};

/** What one ship is worth before daily caps. */
export function shipWeight(ship: ScorableShip): number {
  switch (ship.shipType) {
    case "RELEASE":
      // Releases recorded before outship checked for notes keep the weight
      // they were scored with; there's no record of what they contained.
      return ship.releaseHasNotes === false ? BARE_RELEASE_POINTS : RELEASE_POINTS;
    case "MERGE":
      return ship.weightClass === "REVIEWED" || ship.weightClass === "EXTERNAL" ? REVIEWED_MERGE_POINTS : MERGE_POINTS;
    case "PUSH":
      return PUSH_POINTS;
  }
}

export function toUtcDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

/**
 * Which daily cap a ship counts against: its type's, per UTC day, except
 * imported past commits, which have their own (PAST_COMMITS_PER_DAY).
 */
export function capBucket(ship: ScorableShip): { key: string; cap: number } {
  const day = toUtcDayNumber(ship.shippedAt);
  if (ship.shipType === "PUSH" && ship.source === "BACKFILL") return { key: `${day}:PUSH:past`, cap: PAST_COMMITS_PER_DAY };
  return { key: `${day}:${ship.shipType}`, cap: DAILY_CAPS[ship.shipType] };
}

/** Points from ships after the daily caps. Order of the input doesn't matter. */
export function shipPoints(ships: ScorableShip[]): number {
  const buckets = new Map<string, { cap: number; weights: number[] }>();
  for (const ship of ships) {
    const { key, cap } = capBucket(ship);
    const bucket = buckets.get(key);
    if (bucket) bucket.weights.push(shipWeight(ship));
    else buckets.set(key, { cap, weights: [shipWeight(ship)] });
  }
  let points = 0;
  for (const { cap, weights } of buckets.values()) {
    weights.sort((a, b) => b - a);
    for (let i = 0; i < Math.min(cap, weights.length); i++) points += weights[i];
  }
  return points;
}

export function computeScore({ points, currentStreak }: { points: number; currentStreak: number }): number {
  return points + streakBonus(currentStreak);
}

export type Streak = { currentStreak: number; longestStreak: number; lastShipDate: Date | null };

/**
 * Streaks derived from the ships themselves rather than incremented as
 * webhooks arrive, so out-of-order deliveries, redeliveries and concurrent
 * webhooks all end up at the same answer.
 *
 * A streak is a run of consecutive UTC days with at least one ship. The
 * current one is alive if its last day is today or yesterday (today's ship
 * can still extend it); a whole missed UTC day ends it.
 */
export function deriveStreak(shippedAt: Date[], now = new Date()): Streak {
  if (shippedAt.length === 0) return { currentStreak: 0, longestStreak: 0, lastShipDate: null };

  const days = [...new Set(shippedAt.map(toUtcDayNumber))].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  // `run` is now the run ending on the latest day.
  const today = toUtcDayNumber(now);
  const lastDay = days[days.length - 1];
  const alive = lastDay >= today - 1;

  const lastShipDate = new Date(Math.max(...shippedAt.map((date) => date.getTime())));
  return { currentStreak: alive ? run : 0, longestStreak: longest, lastShipDate };
}

/** Everything scoring stores on a Builder, from their ships. */
export function scoreBuilder(ships: ScorableShip[], now = new Date()): Streak & { score: number; points: number } {
  const streak = deriveStreak(
    ships.map((ship) => ship.shippedAt),
    now,
  );
  const points = shipPoints(ships);
  return { ...streak, points, score: computeScore({ points, currentStreak: streak.currentStreak }) };
}
