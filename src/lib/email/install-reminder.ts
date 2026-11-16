// The one "install the GitHub App" reminder. Someone who signs in but never
// installs the App has an outship profile that never counts a ship, so about
// 30 minutes after sign-in, if it still isn't installed, they get one email
// from reminder@ with the install link. Run every 10 minutes by the cron in
// wrangler.jsonc (see worker.js).
import { FROM_REMINDER, STOP_CODES, sendEmail } from "./send";
import { installReminderEmail } from "./templates";

/** How long after sign-in the reminder waits for the App to be installed. */
export const INSTALL_REMINDER_DELAY_MS = 30 * 60_000;
/**
 * Only sign-ins this recent are reminded. A week covers a cron that was down
 * for a while, without emailing accounts from long before the reminder existed.
 */
export const INSTALL_REMINDER_WINDOW_MS = 7 * 86_400_000;

const BATCH = 50;

type Due = { id: string; githubLogin: string; email: string };

/**
 * Sends the reminder to every builder who signed in at least 30 minutes ago
 * (and within the last week), has an email, hasn't installed the App and
 * hasn't been reminded. Each one is claimed by setting installReminderSentAt
 * before sending, so overlapping runs never send twice; a failure that would
 * hit everyone releases the claim, so the next run retries.
 */
export async function sendInstallReminders(
  db: D1Database,
  emailBinding: SendEmail | undefined,
  now = new Date(),
): Promise<{ sent: number; failed: number; stoppedOn?: string }> {
  const dueBy = new Date(now.getTime() - INSTALL_REMINDER_DELAY_MS).toISOString();
  const notBefore = new Date(now.getTime() - INSTALL_REMINDER_WINDOW_MS).toISOString();
  // julianday() compares the instants, whichever ISO form a row was written in.
  const { results: due } = await db
    .prepare(
      `SELECT "id", "githubLogin", "email" FROM "Builder"
        WHERE "installationId" IS NULL
          AND "email" IS NOT NULL
          AND "claimedAt" IS NOT NULL
          AND "installReminderSentAt" IS NULL
          -- Never installed at all: someone who installed and then removed
          -- it gets the uninstall note instead (uninstall-note.ts).
          AND NOT EXISTS (SELECT 1 FROM "Installation" i WHERE lower(i."accountLogin") = lower("Builder"."githubLogin"))
          AND julianday("claimedAt") <= julianday(?1)
          AND julianday("claimedAt") > julianday(?2)
        ORDER BY "claimedAt"
        LIMIT ${BATCH}`,
    )
    .bind(dueBy, notBefore)
    .all<Due>();

  let sent = 0;
  let failed = 0;
  for (const builder of due) {
    // Claim it; skip if another run did, or the App was installed meanwhile.
    const claim = await db
      .prepare(
        `UPDATE "Builder" SET "installReminderSentAt" = ?1
          WHERE "id" = ?2 AND "installReminderSentAt" IS NULL AND "installationId" IS NULL`,
      )
      .bind(now.toISOString(), builder.id)
      .run();
    if (claim.meta.changes !== 1) continue;

    const outcome = await sendEmail(emailBinding, {
      to: builder.email,
      from: FROM_REMINDER,
      email: installReminderEmail({ login: builder.githubLogin }),
    });
    if (!outcome.ok && STOP_CODES.has(outcome.code)) {
      await db
        .prepare(`UPDATE "Builder" SET "installReminderSentAt" = NULL WHERE "id" = ?1`)
        .bind(builder.id)
        .run();
      return { sent, failed, stoppedOn: outcome.code };
    }
    // A per-recipient failure (bounced, suppressed) stays marked: it's not
    // retried, as the welcome email isn't.
    if (outcome.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
