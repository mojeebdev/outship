import { getDb } from "@/lib/db";
import { apiError, apiRoute, preflight } from "@/lib/api/guard";
import { visibleBuilder } from "@/lib/api/builders";
import { parseShipType, shipJson } from "@/lib/api/serialize";

export const dynamic = "force-dynamic";

// GET /api/v1/verify?login=&repo=&type=&identifier=
// Did this person ship this? `type` and `identifier` are optional: without
// them it answers whether they shipped anything in that repo.
// A private repo always answers "not verified": its existence isn't ours to
// confirm.
export const GET = apiRoute(async (request) => {
  const url = new URL(request.url);
  const login = url.searchParams.get("login") ?? "";
  const repo = url.searchParams.get("repo") ?? "";
  const typeParam = url.searchParams.get("type");
  const type = parseShipType(typeParam);
  const identifier = url.searchParams.get("identifier");
  if (!login || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return apiError(400, "`login` and `repo` (owner/name) are required");
  if (typeParam && !type) return apiError(400, "`type` must be release, merge or push");
  if (identifier && !type) return apiError(400, "`identifier` needs a `type`");

  const db = await getDb();
  const builder = await visibleBuilder(db, login);
  if (!builder) return Response.json({ verified: false, login, repo });

  const where = { builderId: builder.id, repo, isPrivate: false, ...(type ? { shipType: type } : {}) };
  const ship = identifier
    ? await db.ship.findFirst({
        // A push's public identifier is its day; stored ones also carry the builder.
        where: type === "PUSH" ? { ...where, identifier: { startsWith: `${identifier}:` } } : { ...where, identifier },
        include: { attestation: true },
      })
    : await db.ship.findFirst({ where, orderBy: { shippedAt: "desc" }, include: { attestation: true } });
  const count = identifier ? (ship ? 1 : 0) : await db.ship.count({ where });

  return Response.json({
    verified: ship !== null,
    login: builder.githubLogin,
    repo,
    ...(identifier ? {} : { ships: count }),
    ship: ship ? shipJson(ship) : null,
  });
});

export const OPTIONS = preflight;
