import { SITE_URL, STOP_CODES, FROM_SHIPMARKS, sendEmail } from "./send";
import { shipmarkAwardEmail } from "./templates";

const BATCH = 50;

type PendingShipmark = {
  id: string;
  builderId: string;
  githubLogin: string;
  email: string;
  code: string;
  earnedAt: string;
  snapshot: string;
};

const TITLES: Record<string, string> = {
  "welcome-aboard": "Welcome Aboard",
  "first-ship": "First Ship",
  "daily-ship": "Daily Shipmark",
  "weekly-streak": "Weekly Streak",
  "monthly-challenge": "Monthly Challenge",
};

function titleFor(code: string): string {
  const streak = /^streak-(\d+)$/.exec(code);
  return streak ? `${streak[1]}-Day Streak` : TITLES[code] ?? code.replaceAll("-", " ");
}

function detailsFor(mark: PendingShipmark): { label: string; value: string }[] {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(mark.snapshot);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // The badge notice still works if an older snapshot has a different shape.
  }

  const count = (key: string) => {
    const value = Number(data[key]);
    return Number.isFinite(value) && value >= 0 ? String(value) : null;
  };
  const details: { label: string; value: string }[] = [];
  if (mark.code === "daily-ship" || mark.code === "weekly-streak" || mark.code === "monthly-challenge") {
    const ships = count("ships");
    if (ships !== null) details.push({ label: "ships", value: ships });
  }
  if (mark.code === "daily-ship") {
    const rank = count("rank");
    if (rank !== null) details.push({ label: "day rank", value: `#${rank}` });
  }
  if (mark.code === "weekly-streak") {
    const commits = count("commits");
    const merges = count("merges");
    if (commits !== null) details.push({ label: "commits", value: commits });
    if (merges !== null) details.push({ label: "merges", value: merges });
  }
  if (mark.code === "weekly-streak" || mark.code === "monthly-challenge") {
    const activeDays = count("activeDays");
    if (activeDays !== null) details.push({ label: "active days", value: activeDays });
  }
  const streakDays = /^streak-(\d+)$/.exec(mark.code)?.[1];
  if (streakDays) details.push({ label: "streak milestone", value: `${streakDays} days` });
  return details;
}

/** Sends only newly awarded, non-backfill Shipmarks to builders who left notices on. */
export async function sendShipmarkAwardEmails(
  db: D1Database,
  emailBinding: SendEmail | undefined,
  now = new Date(),
): Promise<{ sent: number; failed: number; stoppedOn?: string }> {
  let sent = 0;
  let failed = 0;
  let afterEarnedAt: string | null = null;
  let afterId: string | null = null;

  for (;;) {
    const batch: PendingShipmark[] = (await db.prepare(
      `SELECT m."id", m."builderId", m."code", m."earnedAt", m."snapshot",
              b."githubLogin", b."email"
         FROM "Shipmark" m JOIN "Builder" b ON b."id" = m."builderId"
        WHERE m."source" = 'SCHEDULED'
          AND m."notificationSentAt" IS NULL
          AND b."email" IS NOT NULL
          AND b."shipmarkEmailsEnabled" = 1
          AND (?1 IS NULL OR julianday(m."earnedAt") > julianday(?1)
               OR (julianday(m."earnedAt") = julianday(?1) AND m."id" > ?2))
        ORDER BY julianday(m."earnedAt"), m."id"
        LIMIT ${BATCH}`,
    ).bind(afterEarnedAt, afterId).all<PendingShipmark>()).results;
    if (batch.length === 0) break;

    for (const mark of batch) {
      afterEarnedAt = mark.earnedAt;
      afterId = mark.id;
      const claim = await db.prepare(
        `UPDATE "Shipmark" SET "notificationSentAt" = ?1
          WHERE "id" = ?2 AND "notificationSentAt" IS NULL`,
      ).bind(now.toISOString(), mark.id).run();
      if (claim.meta.changes !== 1) continue;

      const outcome = await sendEmail(emailBinding, {
        to: mark.email,
        from: FROM_SHIPMARKS,
        email: shipmarkAwardEmail({
          login: mark.githubLogin,
          title: titleFor(mark.code),
          details: detailsFor(mark),
          profileUrl: `${SITE_URL}/profile/shipmarks`,
          settingsUrl: `${SITE_URL}/profile/settings`,
        }),
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
  }

  return { sent, failed };
}
