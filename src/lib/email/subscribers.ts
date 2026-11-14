import type { PrismaClient } from "@prisma/client/wasm.js";
import { newToken, sendEmail, FROM_WELCOME } from "./send";
import { recapConfirmEmail } from "./templates";

const CONFIRM_RESEND_AFTER_MS = 10 * 60 * 1000;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A recap signup from the public form. Never reveals whether the address is
 * already on the list: the caller always answers the same way.
 *
 * New or previously unsubscribed addresses go to PENDING and get the
 * welcome-and-confirm email. A PENDING address gets it again at most once
 * every 10 minutes, so the form can't be used to flood someone's inbox.
 * CONFIRMED addresses are left alone.
 */
export async function requestRecapSignup(
  db: PrismaClient,
  emailBinding: SendEmail | undefined,
  email: string,
): Promise<void> {
  const now = new Date();
  const existing = await db.subscriber.findUnique({ where: { email } });

  if (existing?.status === "CONFIRMED") return;
  if (
    existing?.status === "PENDING" &&
    existing.lastConfirmSentAt &&
    now.getTime() - existing.lastConfirmSentAt.getTime() < CONFIRM_RESEND_AFTER_MS
  ) {
    return;
  }

  const subscriber = existing
    ? await db.subscriber.update({
        where: { id: existing.id },
        data: { status: "PENDING", unsubscribedAt: null, lastConfirmSentAt: now },
      })
    : await db.subscriber.create({
        data: { email, token: newToken(), lastConfirmSentAt: now },
      });

  await sendEmail(emailBinding, {
    to: subscriber.email,
    from: FROM_WELCOME,
    email: recapConfirmEmail(subscriber.token),
  });
}

export type TokenState = "pending" | "confirmed" | "unsubscribed" | "invalid";

export async function subscriberState(db: PrismaClient, token: string): Promise<TokenState> {
  if (!token) return "invalid";
  const subscriber = await db.subscriber.findUnique({ where: { token } });
  if (!subscriber) return "invalid";
  return subscriber.status.toLowerCase() as TokenState;
}

/** Only a PENDING subscriber can be confirmed; an unsubscribe is never undone by an old link. */
export async function confirmByToken(db: PrismaClient, token: string): Promise<TokenState> {
  if (!token) return "invalid";
  const { count } = await db.subscriber.updateMany({
    where: { token, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  return count > 0 ? "confirmed" : subscriberState(db, token);
}

export async function unsubscribeByToken(db: PrismaClient, token: string): Promise<TokenState> {
  if (!token) return "invalid";
  const { count } = await db.subscriber.updateMany({
    where: { token, status: { not: "UNSUBSCRIBED" } },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
  return count > 0 ? "unsubscribed" : subscriberState(db, token);
}

/**
 * A signed-in builder switching the recap on from their profile. Their email
 * is GitHub-verified and they asked for it themselves, so no confirmation
 * round-trip is needed.
 */
export async function setBuilderRecap(
  db: PrismaClient,
  email: string,
  on: boolean,
): Promise<void> {
  const now = new Date();
  if (on) {
    await db.subscriber.upsert({
      where: { email },
      create: { email, token: newToken(), status: "CONFIRMED", confirmedAt: now },
      update: { status: "CONFIRMED", confirmedAt: now, unsubscribedAt: null },
    });
  } else {
    await db.subscriber.updateMany({
      where: { email, status: { not: "UNSUBSCRIBED" } },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: now },
    });
  }
}
