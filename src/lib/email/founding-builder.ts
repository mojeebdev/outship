import { FOUNDING_WINDOW_END } from "@/lib/shipmarks";
import { FROM_FOUNDER, FROM_SHIPMARKS, STOP_CODES, sendEmail } from "./send";
import { foundingBuilderEmail } from "./templates";

const BATCH = 50;

type FoundingMark = {
  id: string;
  email: string;
};

/**
 * Sends the one-time email only for launch-cohort marks. Historical backfill
 * rows and ordinary scheduled awards can never enter this queue.
 */
export async function sendFoundingBuilderEmails(
  db: D1Database,
  emailBinding: SendEmail | undefined,
  now = new Date(),
): Promise<{ sent: number; failed: number; skipped?: string; stoppedOn?: string }> {
  if (now.getTime() < Date.parse(FOUNDING_WINDOW_END)) {
    return { sent: 0, failed: 0, skipped: "founding window is still open" };
  }

  const { results } = await db.prepare(
    `SELECT m."id", b."email"
       FROM "Shipmark" m JOIN "Builder" b ON b."id" = m."builderId"
      WHERE m."code" = 'founding-builder'
        AND m."source" = 'FOUNDING_COHORT'
        AND m."notificationSentAt" IS NULL
        AND b."email" IS NOT NULL
        AND b."shipmarkEmailsEnabled" = 1
      ORDER BY m."earnedAt", b."githubLogin"
      LIMIT ${BATCH}`,
  ).all<FoundingMark>();

  let sent = 0;
  let failed = 0;
  for (const mark of results) {
    const claim = await db.prepare(
      `UPDATE "Shipmark" SET "notificationSentAt" = ?1
        WHERE "id" = ?2 AND "notificationSentAt" IS NULL`,
    ).bind(now.toISOString(), mark.id).run();
    if (claim.meta.changes !== 1) continue;

    const outcome = await sendEmail(emailBinding, {
      to: mark.email,
      from: FROM_SHIPMARKS,
      replyTo: FROM_FOUNDER,
      email: foundingBuilderEmail(),
    });
    if (outcome.ok) {
      sent += 1;
      continue;
    }

    failed += 1;
    await db.prepare(
      `UPDATE "Shipmark" SET "notificationSentAt" = NULL WHERE "id" = ?1`,
    ).bind(mark.id).run();
    if (STOP_CODES.has(outcome.code)) return { sent, failed, stoppedOn: outcome.code };
  }

  return { sent, failed };
}
