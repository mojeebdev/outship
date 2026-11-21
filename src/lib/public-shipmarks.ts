import { FOUNDING_WINDOW_END, FOUNDING_WINDOW_LABEL, FOUNDING_WINDOW_START, utcDay, utcMonday } from "@/lib/shipmarks";
import type { Shipmark } from "@/components/shipmark-collection";

const DAY_MS = 86_400_000;
const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const;

type PublicShipDay = {
  day: string;
  firstShipAt: string;
  ships: number | string;
  commits: number | string;
  merges: number | string;
};

type PeriodTotals = {
  ships: number;
  commits: number;
  merges: number;
  activeDays: number;
};

/**
 * Rebuild a public-safe Shipmark record exclusively from public ships.
 * Stored Shipmark snapshots are intentionally never read here: they can
 * contain totals derived from private repositories.
 */
export async function publicShipmarks(
  db: D1Database,
  builderId: string,
  now = new Date(),
): Promise<Shipmark[]> {
  const today = utcDay(now);
  const rows = await db.prepare(
    `SELECT strftime('%Y-%m-%d', "shippedAt") AS day,
            MIN("shippedAt") AS firstShipAt,
            COUNT(*) AS ships,
            COUNT(DISTINCT "commitSha") AS commits,
            SUM(CASE WHEN "shipType" = 'MERGE' THEN 1 ELSE 0 END) AS merges
       FROM "Ship"
      WHERE "builderId" = ?1 AND "isPrivate" = 0
      GROUP BY day
      ORDER BY day ASC`,
  ).bind(builderId).all<PublicShipDay>();
  const builder = await db.prepare(
    `SELECT "claimedAt" FROM "Builder" WHERE "id" = ?1`,
  ).bind(builderId).first<{ claimedAt: string | null }>();

  const days = (rows.results ?? []).map((row) => ({
    day: row.day,
    firstShipAt: row.firstShipAt,
    ships: Number(row.ships),
    commits: Number(row.commits),
    merges: Number(row.merges),
  })).filter((row) => row.day && row.day <= today && row.firstShipAt && Number.isFinite(Date.parse(`${row.day}T00:00:00.000Z`)));
  const marks: Shipmark[] = [];
  const claimedAt = builder?.claimedAt;
  if (
    now.getTime() >= Date.parse(FOUNDING_WINDOW_END) &&
    claimedAt &&
    Date.parse(claimedAt) >= Date.parse(FOUNDING_WINDOW_START) &&
    Date.parse(claimedAt) < Date.parse(FOUNDING_WINDOW_END)
  ) {
    marks.push({
      id: "public-founding-builder",
      code: "founding-builder",
      period: "lifetime",
      earnedAt: claimedAt,
      snapshot: JSON.stringify({
        joinedAt: claimedAt,
        launchWindow: FOUNDING_WINDOW_LABEL,
        scope: "Outship public launch",
      }),
    });
  }

  if (days.length === 0) return marks;

  const first = days[0];
  marks.push({
    id: "public-first-ship",
    code: "first-ship",
    period: "public",
    earnedAt: first.firstShipAt,
    snapshot: JSON.stringify({ scope: "public repositories" }),
  });

  const yesterday = utcDay(new Date(Date.parse(`${today}T00:00:00.000Z`) - DAY_MS));
  for (const row of days) {
    // A daily record is complete after its UTC day closes.
    if (row.day <= yesterday) {
      marks.push({
        id: `public-daily-ship-${row.day}`,
        code: "daily-ship",
        period: row.day,
        earnedAt: `${row.day}T23:59:59.999Z`,
        snapshot: JSON.stringify({ ships: row.ships, commits: row.commits, merges: row.merges, scope: "public repos" }),
      });
    }
  }

  const weeks = new Map<string, PeriodTotals>();
  const months = new Map<string, PeriodTotals>();
  for (const row of days) {
    const date = new Date(`${row.day}T00:00:00.000Z`);
    const week = utcDay(utcMonday(date));
    const month = row.day.slice(0, 7);
    for (const [key, collection] of [[week, weeks], [month, months]] as const) {
      const total = collection.get(key) ?? { ships: 0, commits: 0, merges: 0, activeDays: 0 };
      total.ships += row.ships;
      total.commits += row.commits;
      total.merges += row.merges;
      total.activeDays += 1;
      collection.set(key, total);
    }
  }

  for (const [week, total] of weeks) {
    const weekEnd = Date.parse(`${week}T00:00:00.000Z`) + 7 * DAY_MS;
    if (weekEnd <= now.getTime() && total.activeDays >= 5) {
      marks.push({
        id: `public-weekly-streak-${week}`,
        code: "weekly-streak",
        period: week,
        earnedAt: new Date(weekEnd).toISOString(),
        snapshot: JSON.stringify({ ships: total.ships, commits: total.commits, merges: total.merges, activeDays: total.activeDays, scope: "public repos" }),
      });
    }
  }

  for (const [month, total] of months) {
    const [year, monthNumber] = month.split("-").map(Number);
    const monthEnd = Date.UTC(year, monthNumber, 1);
    if (monthEnd <= now.getTime() && total.ships >= 20) {
      marks.push({
        id: `public-monthly-challenge-${month}`,
        code: "monthly-challenge",
        period: month,
        earnedAt: new Date(monthEnd).toISOString(),
        snapshot: JSON.stringify({ ships: total.ships, activeDays: total.activeDays, scope: "public repos" }),
      });
    }
  }

  let streak = 0;
  let previousDay: string | null = null;
  const awardedMilestones = new Set<number>();
  for (const row of days) {
    const current = Date.parse(`${row.day}T00:00:00.000Z`);
    const previous = previousDay ? Date.parse(`${previousDay}T00:00:00.000Z`) : null;
    streak = previous !== null && current - previous === DAY_MS ? streak + 1 : 1;
    previousDay = row.day;
    for (const milestone of STREAK_MILESTONES) {
      if (streak >= milestone && !awardedMilestones.has(milestone)) {
        awardedMilestones.add(milestone);
        marks.push({
          id: `public-streak-${milestone}`,
          code: `streak-${milestone}`,
          period: `public-${milestone}`,
          earnedAt: row.firstShipAt,
          snapshot: JSON.stringify({ days: milestone, scope: "public ships" }),
        });
      }
    }
  }

  return marks.sort((a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt) || a.code.localeCompare(b.code));
}
