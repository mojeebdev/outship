// "Your crew": the unclaimed builders who ship in a builder's repos, so the
// person who knows them can tell them their work is already on outship.
// outship has no email for an unclaimed builder and never contacts them
// itself; this hands the nudge to someone they actually know.
import { isBotLogin } from "@/lib/bots";
import { shareOnXHref } from "@/lib/share";
import { SITE_URL } from "@/lib/structured-data";

export const CREW_SIZE = 6;

export type CrewMember = { githubId: number; githubLogin: string; ships: number };

/**
 * Unclaimed, public builders with ships in the repos this builder ships in,
 * or in repos under their own account; most ships first. Bots are left out.
 */
export async function crewFor(db: D1Database, builder: { id: string; githubLogin: string }, size = CREW_SIZE): Promise<CrewMember[]> {
  const { results } = await db
    .prepare(
      `SELECT b."githubId", b."githubLogin", COUNT(s."id") AS ships
         FROM "Ship" s JOIN "Builder" b ON b."id" = s."builderId"
        WHERE b."claimedAt" IS NULL
          AND b."hidden" = 0
          AND b."id" != ?1
          AND (s."repo" IN (SELECT DISTINCT "repo" FROM "Ship" WHERE "builderId" = ?1)
               OR substr(lower(s."repo"), 1, length(?2) + 1) = lower(?2) || '/')
        GROUP BY b."id"
        ORDER BY ships DESC, b."githubLogin"
        LIMIT ?3`,
    )
    .bind(builder.id, builder.githubLogin, size * 2)
    .all<{ githubId: number; githubLogin: string; ships: number }>();
  return results
    .filter((row) => !isBotLogin(row.githubLogin))
    .slice(0, size)
    .map((row) => ({ githubId: Number(row.githubId), githubLogin: row.githubLogin, ships: Number(row.ships) }));
}

/**
 * "Your work's already on outship": a post for someone who knows them. Names
 * their GitHub login, not an @: their X handle may be someone else's.
 */
export function claimNudgeHref(login: string): string {
  return shareOnXHref(
    `${login}, your github work is already on outship 👀 claim your profile and keep your streak:`,
    `${SITE_URL}/@${login}`,
  );
}
