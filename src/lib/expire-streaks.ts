import { STREAK_CAP } from "@/lib/score";

/**
 * A streak only changes when a ship arrives, so a builder who stops shipping
 * would keep their old streak, and its score bonus, indefinitely. This runs
 * daily just after midnight UTC and ends every streak whose last ship was
 * before yesterday: those builders have now missed a whole day.
 *
 * Shipping yesterday still counts as alive; today's ship can extend it.
 * Returns how many builders were reset.
 */
export async function expireStaleStreaks(db: D1Database, now = new Date()): Promise<number> {
  const startOfYesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );

  // score = points + min(streak, STREAK_CAP), so drop exactly that bonus.
  // julianday() parses Prisma's stored ISO strings regardless of offset format.
  const result = await db
    .prepare(
      `UPDATE "Builder"
         SET "score" = "score" - MIN("currentStreak", ?1),
             "currentStreak" = 0,
             "updatedAt" = ?2
       WHERE "currentStreak" > 0
         AND julianday("lastShipDate") < julianday(?3)`,
    )
    .bind(STREAK_CAP, now.toISOString(), startOfYesterday.toISOString())
    .run();

  return result.meta.changes ?? 0;
}
