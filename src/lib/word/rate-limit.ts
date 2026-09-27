/**
 * Word — per-IP rate limiting on top of the existing D1 database.
 *
 * Counters live in a small `WordRateLimit` table rather than in a new binding.
 * Each window's counter is bumped with a single atomic upsert (both windows go
 * out in one batched round trip), then read back together.
 */

import { RATE_LIMITS } from "./constants";
import { getDb } from "@/lib/db";

export type RateLimitVerdict = {
  allowed: boolean;
  /** Seconds until the exceeded window resets. Only set when blocked. */
  retryAfterSeconds?: number;
  limitName?: string;
};

type CounterRow = { key: string; count: number | bigint; windowStart: number | bigint };

/**
 * One statement, so a burst of concurrent requests can't read the same stale
 * count: the row is inserted, or incremented, or reset when its window rolled
 * over — decided inside SQLite.
 */
const UPSERT_COUNTER = `INSERT INTO "WordRateLimit" ("key", "windowStart", "count")
  VALUES (?, ?, 1)
  ON CONFLICT("key") DO UPDATE SET
    "count" = CASE WHEN "WordRateLimit"."windowStart" < ? THEN 1
                   ELSE "WordRateLimit"."count" + 1 END,
    "windowStart" = CASE WHEN "WordRateLimit"."windowStart" < ? THEN ?
                         ELSE "WordRateLimit"."windowStart" END`;

/** Identify the caller. Cloudflare sets `cf-connecting-ip` on every request. */
export function clientIdentifier(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Consume one unit of quota for `identifier` against every configured window.
 *
 * Fails open: if D1 is unavailable the scan still runs. Refusing every scan
 * because a counter table hiccuped would take the product down for a
 * non-security reason.
 */
export async function consumeRateLimit(
  identifier: string,
  scope: string,
): Promise<RateLimitVerdict> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const windows = RATE_LIMITS.map((limit) => {
    const windowStart = nowSeconds - (nowSeconds % limit.windowSeconds);
    return { limit, windowStart, key: `${scope}:${limit.name}:${identifier}` };
  });

  try {
    const db = await getDb();

    await db.$transaction(
      windows.map(({ key, windowStart }) =>
        db.$executeRawUnsafe(UPSERT_COUNTER, key, windowStart, windowStart, windowStart, windowStart),
      ),
    );

    const placeholders = windows.map(() => "?").join(", ");
    const rows = await db.$queryRawUnsafe<CounterRow[]>(
      `SELECT "key", "count", "windowStart" FROM "WordRateLimit" WHERE "key" IN (${placeholders})`,
      ...windows.map(({ key }) => key),
    );

    for (const { limit, windowStart, key } of windows) {
      const row = rows.find((candidate) => candidate.key === key);
      if (!row) continue;
      if (Number(row.windowStart) !== windowStart) continue;

      if (Number(row.count) > limit.max) {
        return {
          allowed: false,
          limitName: limit.name,
          retryAfterSeconds: Math.max(1, windowStart + limit.windowSeconds - nowSeconds),
        };
      }
    }

    // Opportunistic cleanup so the table stays tiny without a scheduled job.
    if (Math.random() < 0.02) {
      await db
        .$executeRawUnsafe(
          `DELETE FROM "WordRateLimit" WHERE "windowStart" < ?`,
          nowSeconds - 7_200,
        )
        .catch(() => 0);
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
