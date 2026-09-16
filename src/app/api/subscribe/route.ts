import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_PATTERN.test(email)) {
    return Response.json({ error: "invalid email" }, { status: 400 });
  }

  const db = await getDb();
  await db.subscriber.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  return Response.json({ ok: true });
}
