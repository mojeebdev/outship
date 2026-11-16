import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { DEFAULT_REQUEST_BUDGET, runBackfill } from "@/lib/backfill";
import { timingSafeEqual } from "@/lib/crypto";
import { CRON_HEADER, cronToken } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// The cron in worker.js calls this route in-process (never over the network)
// so the backfill runs with the same database client and helpers as the rest
// of the app. It authenticates with a header only that call can make: a token
// derived from the Worker's own SESSION_SECRET (src/lib/cron-auth.ts).
// Anyone else gets a 404.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const expected = await cronToken(env.SESSION_SECRET);
  const given = request.headers.get(CRON_HEADER) ?? "";
  if (!expected || !timingSafeEqual(given, expected)) return new Response("not found", { status: 404 });

  const budget = Number(env.BACKFILL_REQUEST_BUDGET) || DEFAULT_REQUEST_BUDGET;
  const summary = await runBackfill(
    await getDb(),
    env.DB,
    { appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY },
    { budget },
  );
  return Response.json(summary);
}
