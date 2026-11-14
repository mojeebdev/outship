import { shipPoints, type WeightClass } from "@/lib/score";
import { FROM_RECAP, sendEmail, unsubscribeHeaders } from "./send";
import { weeklyRecapEmail, type RecapData } from "./templates";

const BATCH = 50;

// Failures that will hit every recipient: stop, and let the next hourly run
// (see wrangler.jsonc) pick up where this one left off.
const STOP_CODES = new Set([
  "E_NO_BINDING",
  "E_RATE_LIMIT_EXCEEDED",
  "E_DAILY_LIMIT_EXCEEDED",
  "E_SENDER_NOT_VERIFIED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE",
  "E_ACCOUNT_SUSPENDED",
  "E_INTERNAL_SERVER_ERROR",
]);

/** ISO-8601 week label, e.g. "2026-W47". Weeks start on Monday. */
export function isoWeekLabel(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

type ShipRow = {
  shipType: "RELEASE" | "MERGE" | "PUSH";
  weightClass: WeightClass;
  releaseHasNotes: number | null;
  shippedAt: string;
  repo: string;
  identifier: string;
  isPrivate: number;
  githubLogin: string;
};

/** The last seven days on outship. Private repos are counted, never named. */
export async function buildRecapData(db: D1Database, now = new Date()): Promise<RecapData> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { results: ships } = await db
    .prepare(
      `SELECT s."shipType", s."weightClass", s."releaseHasNotes", s."shippedAt", s."repo", s."identifier", s."isPrivate", b."githubLogin"
         FROM "Ship" s JOIN "Builder" b ON b."id" = s."builderId"
        WHERE julianday(s."shippedAt") >= julianday(?1) AND b."hidden" = 0`,
    )
    .bind(since)
    .all<ShipRow>();

  const byBuilder = new Map<string, ShipRow[]>();
  for (const ship of ships) {
    byBuilder.set(ship.githubLogin, [...(byBuilder.get(ship.githubLogin) ?? []), ship]);
  }

  const top = [...byBuilder.entries()]
    .map(([login, rows]) => ({
      login,
      ships: rows.length,
      points: shipPoints(
        rows.map((row) => ({
          shipType: row.shipType,
          shippedAt: new Date(row.shippedAt),
          weightClass: row.weightClass,
          releaseHasNotes: row.releaseHasNotes === null ? null : Boolean(row.releaseHasNotes),
        })),
      ),
    }))
    .sort((a, b) => b.points - a.points || b.ships - a.ships || a.login.localeCompare(b.login))
    .slice(0, 5);

  const releases = ships
    .filter((ship) => ship.shipType === "RELEASE" && !ship.isPrivate)
    .sort((a, b) => b.shippedAt.localeCompare(a.shippedAt))
    .slice(0, 5)
    .map((ship) => ({ login: ship.githubLogin, repo: ship.repo, tag: ship.identifier }));

  const { results: streaks } = await db
    .prepare(
      `SELECT "githubLogin" AS login, "currentStreak" AS streak FROM "Builder"
        WHERE "currentStreak" > 0 AND "hidden" = 0 ORDER BY "currentStreak" DESC, "githubLogin" LIMIT 3`,
    )
    .all<{ login: string; streak: number }>();

  return {
    weekLabel: isoWeekLabel(now),
    totalShips: ships.length,
    activeBuilders: byBuilder.size,
    top,
    releases,
    streaks,
  };
}

/**
 * Sends this week's recap to every confirmed subscriber who hasn't had it yet.
 * Safe to run repeatedly: each subscriber is marked with the week once their
 * email is sent, so a rerun only reaches the ones still waiting.
 */
export async function sendWeeklyRecap(
  db: D1Database,
  emailBinding: SendEmail | undefined,
  now = new Date(),
): Promise<{ week: string; sent: number; failed: number; stoppedOn?: string; skipped?: string }> {
  const week = isoWeekLabel(now);
  const data = await buildRecapData(db, now);
  if (data.totalShips === 0) {
    return { week, sent: 0, failed: 0, skipped: "no ships this week" };
  }

  let sent = 0;
  let failed = 0;
  for (;;) {
    const { results: batch } = await db
      .prepare(
        `SELECT "id", "email", "token" FROM "Subscriber"
          WHERE "status" = 'CONFIRMED' AND ("recapSentFor" IS NULL OR "recapSentFor" != ?1)
          LIMIT ${BATCH}`,
      )
      .bind(week)
      .all<{ id: string; email: string; token: string }>();
    if (batch.length === 0) break;

    for (const subscriber of batch) {
      const outcome = await sendEmail(emailBinding, {
        to: subscriber.email,
        from: FROM_RECAP,
        email: weeklyRecapEmail(data, subscriber.token),
        headers: unsubscribeHeaders(subscriber.token),
      });
      if (!outcome.ok && STOP_CODES.has(outcome.code)) {
        return { week, sent, failed, stoppedOn: outcome.code };
      }
      // A per-recipient failure (suppressed, invalid) is marked too, so it
      // isn't retried forever; it gets next week's recap as normal.
      if (outcome.ok) sent += 1;
      else failed += 1;
      await db
        .prepare(`UPDATE "Subscriber" SET "recapSentFor" = ?1 WHERE "id" = ?2`)
        .bind(week, subscriber.id)
        .run();
    }
  }

  return { week, sent, failed };
}
