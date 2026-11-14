// Data shared by the public profile (/@handle) and the private dashboard
// (/profile), so the two can't drift apart.
import type { getDb } from "@/lib/db";
import { countByDay } from "@/lib/history";

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
      label: "github history · not part of score",
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
