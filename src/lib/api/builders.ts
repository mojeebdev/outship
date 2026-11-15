// Loading what API v1 returns about a builder, with the same visibility rules
// as the public site: hidden builders don't exist; unclaimed builders are
// public GitHub activity only, so their private-repo ships aren't counted.
import type { getDb } from "@/lib/db";
import { rankIn } from "@/lib/leaderboard";
import { builderJson } from "./serialize";

type Db = Awaited<ReturnType<typeof getDb>>;

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export async function visibleBuilder(db: Db, login: string) {
  if (!LOGIN.test(login)) return null;
  const builder = await db.builder.findUnique({ where: { githubLogin: login } });
  return builder && !builder.hidden ? builder : null;
}

export async function loadBuilderJson(db: Db, builder: NonNullable<Awaited<ReturnType<typeof visibleBuilder>>>) {
  const shipWhere = { builderId: builder.id, ...(builder.claimedAt ? {} : { isPrivate: false }) };
  const [byType, attestations, week, allTime] = await Promise.all([
    db.ship.groupBy({ by: ["shipType"], where: shipWhere, _count: { _all: true } }),
    db.attestation.count({ where: { ship: { builderId: builder.id } } }),
    rankIn(db, "week", builder),
    rankIn(db, "all", builder),
  ]);
  const count = (type: string) => byType.find((row) => row.shipType === type)?._count._all ?? 0;
  return builderJson(builder, {
    ranks: { week, allTime },
    ships: {
      total: count("RELEASE") + count("MERGE") + count("PUSH"),
      releases: count("RELEASE"),
      merges: count("MERGE"),
      pushes: count("PUSH"),
    },
    attestations,
  });
}
