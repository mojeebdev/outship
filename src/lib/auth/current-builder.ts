import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth/session";

export async function getCurrentBuilder() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.SESSION_SECRET) return null;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  const session = await verifySessionCookieValue(cookieValue, env.SESSION_SECRET);
  if (!session) return null;

  const db = await getDb();
  return db.builder.findUnique({ where: { id: session.builderId } });
}
