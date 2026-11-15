// What API v1 says about builders and ships. Public data only: a private
// repo's ships are never listed, matched or counted by repo, and hidden
// builders don't exist as far as the API is concerned.
import { SITE_URL } from "@/lib/structured-data";
import { avatarUrl } from "@/lib/builders";
import { attestationIdentifier } from "@/lib/ships";
import { shipWeight, type ScorableShip } from "@/lib/score";
import { tierFor } from "@/lib/tiers";
import { easscanUrl } from "@/lib/web3/eas";

export const API_VERSION = "v1";

export type ApiBuilderInput = {
  githubId: number;
  githubLogin: string;
  name: string | null;
  claimedAt: Date | null;
  score: number;
  currentStreak: number;
  longestStreak: number;
  lastShipDate: Date | null;
};

export function builderJson(
  builder: ApiBuilderInput,
  extra: {
    ranks: { week: number | null; allTime: number | null };
    ships: { total: number; releases: number; merges: number; pushes: number };
    attestations: number;
  },
) {
  const standing = tierFor(builder.score);
  return {
    login: builder.githubLogin,
    name: builder.name,
    avatarUrl: avatarUrl(builder.githubId, 160),
    claimed: builder.claimedAt !== null,
    score: builder.score,
    tier: { name: standing.tier.name, next: standing.next?.name ?? null, pointsToNext: standing.toNext },
    streak: { current: builder.currentStreak, longest: builder.longestStreak },
    lastShippedAt: builder.lastShipDate?.toISOString() ?? null,
    ranks: extra.ranks,
    ships: extra.ships,
    attestations: extra.attestations,
    profileUrl: `${SITE_URL}/@${builder.githubLogin}`,
    badgeUrl: `${SITE_URL}/@${builder.githubLogin}/badge.svg`,
  };
}

export type ApiShipInput = ScorableShip & {
  id: string;
  repo: string;
  identifier: string;
  commitSha: string | null;
  attestation: { easUid: string; chain: string; schemaVersion: number } | null;
};

const TYPE_NAMES = { RELEASE: "release", MERGE: "merge", PUSH: "push" } as const;

export function shipJson(ship: ApiShipInput) {
  return {
    id: ship.id,
    type: TYPE_NAMES[ship.shipType],
    repo: ship.repo,
    // The public identifier: a tag, a PR number, or a push's UTC day.
    identifier: attestationIdentifier(ship),
    commitSha: ship.commitSha,
    shippedAt: ship.shippedAt.toISOString(),
    // Before daily caps: what this ship is worth on its own.
    points: shipWeight(ship),
    weightClass: ship.weightClass ?? "STANDARD",
    attestation: ship.attestation
      ? {
          uid: ship.attestation.easUid,
          chain: ship.attestation.chain,
          verified: ship.attestation.schemaVersion >= 2,
          url: easscanUrl(ship.attestation.chain, ship.attestation.easUid),
        }
      : null,
  };
}

/** Maps the API's ship type names back to the stored enum. */
export function parseShipType(value: string | null): "RELEASE" | "MERGE" | "PUSH" | null {
  if (value === "release") return "RELEASE";
  if (value === "merge") return "MERGE";
  if (value === "push") return "PUSH";
  return null;
}
