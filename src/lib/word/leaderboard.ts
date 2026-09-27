/**
 * Word — homepage leaderboard reads.
 *
 * Shared by the page (server-rendered) and the API route so both show the same
 * shape and ordering.
 */

import { getDb } from "@/lib/db";

export const LEADERBOARD_SIZE = 10;

export type LeaderboardEntry = {
  hostname: string;
  url: string;
  wordCount: number;
  lastScannedAt: string;
};

/** Top opt-in homepages by word count. Every row was scanned by this server. */
export async function listLeaderboard(take = LEADERBOARD_SIZE): Promise<LeaderboardEntry[]> {
  try {
    const db = await getDb();
    const sites = await db.wordSite.findMany({
      orderBy: { wordCount: "desc" },
      take,
      select: { hostname: true, url: true, wordCount: true, lastScannedAt: true },
    });

    return sites.map((site) => ({
      hostname: site.hostname,
      url: site.url,
      wordCount: site.wordCount,
      lastScannedAt: site.lastScannedAt.toISOString(),
    }));
  } catch {
    // An empty leaderboard is a better failure than a broken page — the counter
    // itself doesn't depend on the database.
    return [];
  }
}
