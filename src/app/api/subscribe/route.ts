import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { EMAIL_PATTERN, requestRecapSignup } from "@/lib/email/subscribers";
import { clientIdentifier, consumeRateLimit } from "@/lib/word/rate-limit";

export const dynamic = "force-dynamic";

// Tighter than Word's scan limits: each accepted signup can send an email.
const SIGNUP_LIMITS = [
  { name: "minute", windowSeconds: 60, max: 3 },
  { name: "hour", windowSeconds: 3_600, max: 10 },
] as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return Response.json({ error: "invalid email" }, { status: 400 });
  }

  const verdict = await consumeRateLimit(clientIdentifier(request), "subscribe", SIGNUP_LIMITS);
  if (!verdict.allowed) {
    return Response.json(
      { error: "too many signups, try again later" },
      { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds ?? 60) } },
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  await requestRecapSignup(await getDb(), env.EMAIL, email);

  // Same answer whether the address was new, pending or already confirmed.
  return Response.json({ ok: true });
}
