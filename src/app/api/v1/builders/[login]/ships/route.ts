import { getDb } from "@/lib/db";
import { apiError, apiRoute, preflight } from "@/lib/api/guard";
import { visibleBuilder } from "@/lib/api/builders";
import { parseShipType, shipJson } from "@/lib/api/serialize";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

// GET /api/v1/builders/{login}/ships?limit=&before=&type=
// Public ships, newest first. Page with `before` = the last ship's shippedAt.
export const GET = apiRoute(async (request) => {
  const url = new URL(request.url);
  const login = decodeURIComponent(url.pathname.split("/")[4] ?? "");
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : null;
  if (before && Number.isNaN(before.getTime())) return apiError(400, "`before` must be an ISO 8601 time");
  const typeParam = url.searchParams.get("type");
  const type = parseShipType(typeParam);
  if (typeParam && !type) return apiError(400, "`type` must be release, merge or push");

  const db = await getDb();
  const builder = await visibleBuilder(db, login);
  if (!builder) return apiError(404, "no builder with that login");

  const ships = await db.ship.findMany({
    where: {
      builderId: builder.id,
      // Private repos count toward score but are never listed.
      isPrivate: false,
      ...(type ? { shipType: type } : {}),
      ...(before ? { shippedAt: { lt: before } } : {}),
    },
    orderBy: [{ shippedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { attestation: true },
  });
  const page = ships.slice(0, limit);
  return Response.json({
    ships: page.map(shipJson),
    next: ships.length > limit ? page[page.length - 1].shippedAt.toISOString() : null,
  });
});

export const OPTIONS = preflight;
