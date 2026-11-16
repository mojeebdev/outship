// "Your last 12 months are in": once a builder's history import has finished,
// one email from Mojeeb with their points and how many past ships came in.
// Run every 10 minutes by the cron in worker.js, after the install reminders.
//
// Finished means: their installation has been queued for the import
// (backfillQueuedAt) and has no PENDING job left. Only builders the import
// actually found ships for are emailed; the rest have nothing to show yet.
import { profileShareText, shareOnXHref } from "@/lib/share";
import { tierFor } from "@/lib/tiers";
import { FROM_FOUNDER, STOP_CODES, sendEmail } from "./send";
import { historyReadyEmail } from "./templates";

/**
 * When the import came back (the restore deploy, 16 Nov 2026). Builders who
 * joined before it saw 0 all-time points while it was off, so their email
 * opens with an apology; everyone after gets the same email without it.
 */
export const HISTORY_RESTORED_AT = new Date("2026-11-16T11:00:00.000Z");

const BATCH = 50;

type Ready = {
  id: string;
  githubLogin: string;
  name: string | null;
  email: string;
  score: number;
  currentStreak: number;
  claimedAt: string;
  imported: number;
};

export async function sendHistoryReadyEmails(
  db: D1Database,
  emailBinding: SendEmail | undefined,
  { skipLogins = [], now = new Date() }: { skipLogins?: string[]; now?: Date } = {},
): Promise<{ sent: number; failed: number; stoppedOn?: string }> {
  const { results } = await db
    .prepare(
      `SELECT b."id", b."githubLogin", b."name", b."email", b."score", b."currentStreak", b."claimedAt",
              (SELECT COUNT(*) FROM "Ship" s WHERE s."builderId" = b."id" AND s."source" = 'BACKFILL') AS imported
         FROM "Builder" b
         JOIN "Installation" i ON i."id" = b."installationId"
        WHERE b."claimedAt" IS NOT NULL
          AND b."email" IS NOT NULL
          AND b."hidden" = 0
          AND b."historyEmailedAt" IS NULL
          AND i."backfillQueuedAt" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "BackfillJob" j WHERE j."installationId" = i."id" AND j."status" = 'PENDING')
          AND EXISTS (SELECT 1 FROM "Ship" s WHERE s."builderId" = b."id" AND s."source" = 'BACKFILL')
        ORDER BY b."claimedAt"
        LIMIT ${BATCH}`,
    )
    .all<Ready>();

  const skip = new Set(skipLogins.map((login) => login.toLowerCase()));
  let sent = 0;
  let failed = 0;
  for (const builder of results) {
    if (skip.has(builder.githubLogin.toLowerCase())) continue;
    // Claim it first, so overlapping runs never send twice.
    const claim = await db
      .prepare(`UPDATE "Builder" SET "historyEmailedAt" = ?1 WHERE "id" = ?2 AND "historyEmailedAt" IS NULL`)
      .bind(now.toISOString(), builder.id)
      .run();
    if (claim.meta.changes !== 1) continue;

    const score = Number(builder.score);
    const outcome = await sendEmail(emailBinding, {
      to: builder.email,
      from: FROM_FOUNDER,
      replyTo: FROM_FOUNDER,
      email: historyReadyEmail({
        login: builder.githubLogin,
        name: builder.name,
        score,
        imported: Number(builder.imported),
        apology: new Date(builder.claimedAt).getTime() < HISTORY_RESTORED_AT.getTime(),
        shareHref: shareOnXHref(
          profileShareText({
            login: builder.githubLogin,
            tier: tierFor(score).tier.name,
            score,
            weekRank: null,
            streak: Number(builder.currentStreak),
          }),
        ),
      }),
    });
    if (!outcome.ok && STOP_CODES.has(outcome.code)) {
      await db.prepare(`UPDATE "Builder" SET "historyEmailedAt" = NULL WHERE "id" = ?1`).bind(builder.id).run();
      return { sent, failed, stoppedOn: outcome.code };
    }
    if (outcome.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
