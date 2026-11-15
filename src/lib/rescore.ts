// Recomputes a builder's points, streak and score from their stored ships and
// writes them in one update. The webhook calls this after every insert, so a
// builder's stats always equal what their ships say, however webhooks arrive.
import type { getDb } from "@/lib/db";
import { scoreBuilder } from "@/lib/score";

type Db = Awaited<ReturnType<typeof getDb>>;

const MAX_ATTEMPTS = 5;

/**
 * D1 has no interactive transactions, so this is optimistic: read the
 * builder's statsVersion, read their ships, write only if the version hasn't
 * moved. If another webhook wrote in between (it may have seen ships this
 * read missed), start over. The last write to succeed always read every ship
 * inserted before it, so the stored stats end up exact.
 */
export async function recomputeBuilder(db: Db, builderId: string, now = new Date()): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const builder = await db.builder.findUnique({ where: { id: builderId }, select: { statsVersion: true } });
    if (!builder) return false;
    const ships = await db.ship.findMany({
      where: { builderId },
      select: { shipType: true, shippedAt: true, weightClass: true, releaseHasNotes: true, source: true },
    });
    const stats = scoreBuilder(ships, now);
    const { count } = await db.builder.updateMany({
      where: { id: builderId, statsVersion: builder.statsVersion },
      data: {
        score: stats.score,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        lastShipDate: stats.lastShipDate,
        statsVersion: { increment: 1 },
      },
    });
    if (count === 1) return true;
  }
  console.warn(`recomputeBuilder: gave up on ${builderId} after ${MAX_ATTEMPTS} conflicting writes`);
  return false;
}
