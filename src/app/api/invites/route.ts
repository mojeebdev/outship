import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { INVITE_ADDRESS, sendEmail } from "@/lib/email/send";
import { inviteEmail } from "@/lib/email/templates";
import {
  INVITES_PER_BUILDER,
  REFUSAL_MESSAGES,
  createInvite,
  dropInvite,
  inviterDisplayName,
  markInviteSent,
} from "@/lib/invites";

export const dynamic = "force-dynamic";

// The "invite friends" form on /profile. JSON in, JSON out. The session
// cookie is SameSite=Lax, so a request from another site arrives signed out
// and is turned away; the guard rails live in src/lib/invites.ts.
export async function POST(request: Request) {
  const builder = await getCurrentBuilder();
  if (!builder?.claimedAt) return Response.json({ error: "sign in to invite friends." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const { env } = await getCloudflareContext({ async: true });
  const result = await createInvite(env.DB, builder, body?.email);
  if (!result.ok) {
    return Response.json({ error: REFUSAL_MESSAGES[result.reason] }, { status: result.reason === "limit" ? 429 : 400 });
  }

  const display = inviterDisplayName(builder.name, builder.githubLogin);
  const outcome = await sendEmail(env.EMAIL, {
    to: result.email,
    from: { email: INVITE_ADDRESS, name: `${display} via outship` },
    email: inviteEmail({ inviterLogin: builder.githubLogin, inviterDisplay: display, token: result.token }),
    headers: {
      "List-Unsubscribe": `<${new URL(`/api/invites/opt-out?token=${encodeURIComponent(result.token)}`, request.url)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (!outcome.ok) {
    // Not sent: give the address and the allowance back.
    await dropInvite(env.DB, result.id);
    return Response.json({ error: "couldn't send that invite right now. try again in a bit." }, { status: 502 });
  }
  await markInviteSent(env.DB, result.id);
  const used = await env.DB.prepare(`SELECT COUNT(*) AS n FROM "Invite" WHERE "inviterId" = ?1`).bind(builder.id).first<{ n: number }>();
  return Response.json({ ok: true, email: result.email, remaining: Math.max(0, INVITES_PER_BUILDER - Number(used?.n ?? 0)) });
}
