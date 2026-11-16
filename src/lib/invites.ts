// Builders inviting friends by email. Guard rails, because a form that emails
// any address someone types is a spam relay waiting to happen, and one abuse
// report can get mail.outship.dev blocked for every email outship sends:
//   - only signed-in builders, and at most INVITES_PER_BUILDER each;
//   - one invite per address, ever, whoever asks (Invite.email is unique);
//   - a fixed message, nothing the inviter writes;
//   - every invite carries a "never email me again" link (Invite.token).
// The join link carries ?ref=<inviter login>, which sign-in stores as the new
// builder's referredById.
import { newToken } from "@/lib/email/send";

export const INVITES_PER_BUILDER = 10;
export const REF_COOKIE = "outship_ref";

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

/** A GitHub login from a ?ref= link, or null. */
export function validRef(raw: unknown): string | null {
  return typeof raw === "string" && LOGIN.test(raw) ? raw : null;
}

/**
 * The inviter as the email's display name: their name or @login, without
 * anything that could break out of a From header, and not too long.
 */
export function inviterDisplayName(name: string | null, login: string): string {
  const clean = (name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/["<>\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
  return clean || `@${login}`;
}

export type InviteRefusal = "invalid" | "self" | "limit" | "member" | "taken";
export type InviteResult = { ok: true; id: string; email: string; token: string } | { ok: false; reason: InviteRefusal };

export const REFUSAL_MESSAGES: Record<InviteRefusal, string> = {
  invalid: "that doesn't look like an email address.",
  self: "that's your own email.",
  limit: `you've sent all ${INVITES_PER_BUILDER} of your invites.`,
  member: "they're already on outship.",
  taken: "someone already invited them. outship only ever sends one invite per address.",
};

export async function createInvite(
  db: D1Database,
  inviter: { id: string; email: string | null },
  raw: unknown,
  now = new Date(),
): Promise<InviteResult> {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, reason: "invalid" };
  if (inviter.email && inviter.email.toLowerCase() === email) return { ok: false, reason: "self" };

  const used = await db.prepare(`SELECT COUNT(*) AS n FROM "Invite" WHERE "inviterId" = ?1`).bind(inviter.id).first<{ n: number }>();
  if (Number(used?.n ?? 0) >= INVITES_PER_BUILDER) return { ok: false, reason: "limit" };

  const member = await db.prepare(`SELECT 1 AS yes FROM "Builder" WHERE lower("email") = ?1 LIMIT 1`).bind(email).first();
  if (member) return { ok: false, reason: "member" };

  const id = crypto.randomUUID();
  const token = newToken();
  const inserted = await db
    .prepare(`INSERT OR IGNORE INTO "Invite" ("id", "inviterId", "email", "token", "createdAt") VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(id, inviter.id, email, token, now.toISOString())
    .run();
  if (inserted.meta.changes !== 1) return { ok: false, reason: "taken" };
  return { ok: true, id, email, token };
}

export async function markInviteSent(db: D1Database, id: string, now = new Date()) {
  await db.prepare(`UPDATE "Invite" SET "sentAt" = ?1 WHERE "id" = ?2`).bind(now.toISOString(), id).run();
}

/** An invite that couldn't be sent: gone, so it doesn't use up the address or the inviter's allowance. */
export async function dropInvite(db: D1Database, id: string) {
  await db.prepare(`DELETE FROM "Invite" WHERE "id" = ?1 AND "sentAt" IS NULL`).bind(id).run();
}

/** "Never email me again". True if the token named an invite. */
export async function optOutOfInvites(db: D1Database, token: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const result = await db
    .prepare(`UPDATE "Invite" SET "optedOutAt" = COALESCE("optedOutAt", ?1) WHERE "token" = ?2`)
    .bind(now.toISOString(), token)
    .run();
  return result.meta.changes === 1;
}

export type InviteRow = { email: string; joined: boolean };

/** A builder's invites, newest first, and whether each friend has joined. */
export async function listInvites(db: D1Database, inviterId: string): Promise<InviteRow[]> {
  const { results } = await db
    .prepare(
      `SELECT i."email",
              EXISTS (SELECT 1 FROM "Builder" b WHERE lower(b."email") = i."email" AND b."claimedAt" IS NOT NULL) AS joined
         FROM "Invite" i
        WHERE i."inviterId" = ?1 AND i."sentAt" IS NOT NULL
        ORDER BY i."createdAt" DESC`,
    )
    .bind(inviterId)
    .all<{ email: string; joined: number }>();
  return results.map((row) => ({ email: row.email, joined: Boolean(row.joined) }));
}
