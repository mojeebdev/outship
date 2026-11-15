import { getDb } from "@/lib/db";
import { apiError, apiRoute, preflight } from "@/lib/api/guard";
import { loadBuilderJson, visibleBuilder } from "@/lib/api/builders";

export const dynamic = "force-dynamic";

// GET /api/v1/builders/{login}: a builder's score, tier, streaks, ranks and
// ship counts.
export const GET = apiRoute(async (request) => {
  const login = decodeURIComponent(new URL(request.url).pathname.split("/")[4] ?? "");
  const db = await getDb();
  const builder = await visibleBuilder(db, login);
  if (!builder) return apiError(404, "no builder with that login");
  return Response.json({ builder: await loadBuilderJson(db, builder) });
});

export const OPTIONS = preflight;
