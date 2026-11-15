// Storing a ship from the live webhook: one row per [repo, shipType,
// identifier], and a merge supersedes the push that landed it.
import type { getDb } from "@/lib/db";
import type { WeightClass } from "@/lib/score";

type Db = Awaited<ReturnType<typeof getDb>>;

export type StorableShip = {
  repo: string;
  shipType: "RELEASE" | "MERGE" | "PUSH";
  identifier: string;
  commitSha: string | null;
  isPrivate: boolean;
  shippedAt: Date;
  weightClass: WeightClass;
  releaseHasNotes: boolean | null;
  language: string | null;
};

export type StoreResult =
  /** Stored. `others` are builders whose pushes it superseded: rescore them. */
  | { stored: true; others: string[] }
  /** Already recorded (a redelivery, or imported and live both saw it). */
  | { stored: false };

export async function storeShip(
  db: Db,
  builderId: string,
  ship: StorableShip,
  source: "WEBHOOK" | "BACKFILL",
): Promise<StoreResult> {
  try {
    await db.ship.create({
      data: {
        builderId,
        repo: ship.repo,
        shipType: ship.shipType,
        identifier: ship.identifier,
        commitSha: ship.commitSha,
        isPrivate: ship.isPrivate,
        shippedAt: ship.shippedAt,
        weightClass: ship.weightClass,
        releaseHasNotes: ship.releaseHasNotes,
        language: ship.language,
        source,
      },
    });
  } catch (error) {
    // unique [repo, shipType, identifier]
    if (error instanceof Error && (error as { code?: string }).code === "P2002") return { stored: false };
    throw error;
  }

  const others = new Set<string>();
  if (ship.shipType === "MERGE" && ship.commitSha) {
    // The push that landed this PR may have arrived first and been counted as
    // a push. The merge supersedes it (unless it was already attested).
    const superseded = await db.ship.findMany({
      where: { shipType: "PUSH", commitSha: ship.commitSha, attestation: { is: null } },
      select: { id: true, builderId: true },
    });
    if (superseded.length > 0) {
      await db.ship.deleteMany({ where: { id: { in: superseded.map((s) => s.id) } } });
      for (const s of superseded) if (s.builderId !== builderId) others.add(s.builderId);
    }
  }
  return { stored: true, others: [...others] };
}
