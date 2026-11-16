// One note from Mojeeb to a builder who uninstalled the GitHub App: what went
// wrong, and the way back. Run every 10 minutes by the cron in worker.js.
//
// It waits UNINSTALL_NOTE_DELAY_MS after the uninstall, so someone who removes
// and reinstalls (say, to change repos) never gets it, and skips anyone with a
// live install again. Uninstalls from the last week are covered, so a cron
// that was down catches up without reaching back to old ones.
import { FROM_FOUNDER, STOP_CODES, sendEmail } from "./send";
import { uninstallNoteEmail } from "./templates";

export const UNINSTALL_NOTE_DELAY_MS = 30 * 60_000;
export const UNINSTALL_NOTE_WINDOW_MS = 7 * 86_400_000;
const BATCH = 50;

type Due = { id: string; githubLogin: string; name: string | null; email: string };

export async function sendUninstallNotes(
  db: D1Database,
  emailBinding: SendEmail | undefined,
  { skipLogins = [], now = new Date() }: { skipLogins?: string[]; now?: Date } = {},
): Promise<{ sent: number; failed: number; stoppedOn?: string }> {
  const dueBy = new Date(now.getTime() - UNINSTALL_NOTE_DELAY_MS).toISOString();
  const notBefore = new Date(now.getTime() - UNINSTALL_NOTE_WINDOW_MS).toISOString();
  const { results } = await db
    .prepare(
      `SELECT b."id", b."githubLogin", b."name", b."email" FROM "Builder" b
        WHERE b."claimedAt" IS NOT NULL
          AND b."email" IS NOT NULL
          AND b."installationId" IS NULL
          AND b."uninstallEmailedAt" IS NULL
          AND EXISTS (
                SELECT 1 FROM "Installation" i
                 WHERE lower(i."accountLogin") = lower(b."githubLogin")
                   AND i."deletedAt" IS NOT NULL
                   AND julianday(i."deletedAt") <= julianday(?1)
                   AND julianday(i."deletedAt") > julianday(?2))
          AND NOT EXISTS (
                SELECT 1 FROM "Installation" i
                 WHERE lower(i."accountLogin") = lower(b."githubLogin") AND i."deletedAt" IS NULL)
        LIMIT ${BATCH}`,
    )
    .bind(dueBy, notBefore)
    .all<Due>();

  const skip = new Set(skipLogins.map((login) => login.toLowerCase()));
  let sent = 0;
  let failed = 0;
  for (const builder of results) {
    if (skip.has(builder.githubLogin.toLowerCase())) continue;
    const claim = await db
      .prepare(`UPDATE "Builder" SET "uninstallEmailedAt" = ?1 WHERE "id" = ?2 AND "uninstallEmailedAt" IS NULL`)
      .bind(now.toISOString(), builder.id)
      .run();
    if (claim.meta.changes !== 1) continue;

    const outcome = await sendEmail(emailBinding, {
      to: builder.email,
      from: FROM_FOUNDER,
      replyTo: FROM_FOUNDER,
      email: uninstallNoteEmail({ login: builder.githubLogin, name: builder.name }),
    });
    if (!outcome.ok && STOP_CODES.has(outcome.code)) {
      await db.prepare(`UPDATE "Builder" SET "uninstallEmailedAt" = NULL WHERE "id" = ?1`).bind(builder.id).run();
      return { sent, failed, stoppedOn: outcome.code };
    }
    if (outcome.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
