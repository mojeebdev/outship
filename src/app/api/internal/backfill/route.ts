import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { DEFAULT_REQUEST_BUDGET, runBackfill } from "@/lib/backfill";
import { timingSafeEqual } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// The cron in worker.js calls this route in-process (never over the network)
// so the backfill runs with the same database client and helpers as the rest
// of the app. It authenticates with a header only that call can set: the
// Worker's own SESSION_SECRET. Anyone else gets a 404.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.SESSION_SECRET;
  const given = request.headers.get("x-outship-cron") ?? "";
  if (!secret || !timingSafeEqual(given, secret)) return new Response("not found", { status: 404 });

  const budget = Number(env.BACKFILL_REQUEST_BUDGET) || DEFAULT_REQUEST_BUDGET;
  const summary = await runBackfill(
    await getDb(),
    env.DB,
    { appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY },
    { budget },
  );
  return Response.json(summary);
}
