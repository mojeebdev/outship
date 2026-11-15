// Data shared by the public profile (/@handle) and the private dashboard
// (/profile), so the two can't drift apart.
import type { getDb } from "@/lib/db";
import { countByDay } from "@/lib/history";
import { rankIn } from "@/lib/leaderboard";

type Db = Awaited<ReturnType<typeof getDb>>;

type HistoryBuilder = {
  id: string;
  historySyncedAt: Date | null;
  historyCommits: number | null;
  historyPullRequests: number | null;
  historyReviews: number | null;
  historyRestricted: number | null;
};

export type HeatmapData = {
  counts: Map<string, number>;
  unit: string;
  label: string;
  totals: { commits: number; pullRequests: number; reviews: number; restricted: number } | null;
};

/**
 * A builder who signed in has imported GitHub history; everyone else (an
 * unclaimed profile, or a sign-in whose import hasn't run) gets their verified
 * ships instead, labelled as such. `publicOnly` leaves private-repo ships out.
 */
export async function loadHeatmap(db: Db, builder: HistoryBuilder, { publicOnly }: { publicOnly: boolean }): Promise<HeatmapData> {
  if (builder.historySyncedAt) {
    const days = await db.contributionDay.findMany({
      where: { builderId: builder.id },
      select: { date: true, count: true },
    });
    return {
      counts: new Map(days.map((day) => [day.date, day.count])),
      unit: "contribution",
      label: "github history",
      totals: {
        commits: builder.historyCommits ?? 0,
        pullRequests: builder.historyPullRequests ?? 0,
        reviews: builder.historyReviews ?? 0,
        restricted: builder.historyRestricted ?? 0,
      },
    };
  }

  const since = new Date(Date.now() - 371 * 86_400_000);
  const ships = await db.ship.findMany({
    where: { builderId: builder.id, shippedAt: { gte: since }, ...(publicOnly ? { isPrivate: false } : {}) },
    select: { shippedAt: true },
  });
  return {
    counts: countByDay(ships.map((ship) => ship.shippedAt)),
    unit: "verified ship",
    label: "verified ships only",
    totals: null,
  };
}

export type ProfileFacts = {
  languages: string[];
  byType: { RELEASE: number; MERGE: number; PUSH: number };
  weekRank: number | null;
  allTimeRank: number | null;
};

/**
 * Top languages come from public ships only, everywhere. The ships-by-type
 * breakdown leaves private ships out when `publicOnly` (an unclaimed
 * profile). Ranks are exactly the leaderboard's.
 */
export async function loadProfileFacts(
  db: Db,
  builder: { id: string; githubLogin: string; score: number; claimedAt: Date | null; hidden: boolean },
  { publicOnly }: { publicOnly: boolean },
): Promise<ProfileFacts> {
  const where = { builderId: builder.id, ...(publicOnly ? { isPrivate: false } : {}) };
  const [languageRows, typeRows, weekRank, allTimeRank] = await Promise.all([
    db.ship.groupBy({
      by: ["language"],
      where: { builderId: builder.id, isPrivate: false, language: { not: null } },
      _count: { _all: true },
    }),
    db.ship.groupBy({ by: ["shipType"], where, _count: { _all: true } }),
    rankIn(db, "week", builder),
    rankIn(db, "all", builder),
  ]);
  const byType = { RELEASE: 0, MERGE: 0, PUSH: 0 };
  for (const row of typeRows) byType[row.shipType] = row._count._all;
  const languages = languageRows
    .filter((row): row is typeof row & { language: string } => row.language !== null)
    .sort((a, b) => b._count._all - a._count._all || a.language.localeCompare(b.language))
    .slice(0, 5)
    .map((row) => row.language);
  return { languages, byType, weekRank, allTimeRank };
}
