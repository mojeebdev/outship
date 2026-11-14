// What a ship's v2 attestation says, built only from outship's own records.
// Both the authorize route (to sign it) and the save route (to check what
// landed onchain) use this, so they can't disagree about a ship.
import { attestationIdentifier, hasRealCommitSha } from "@/lib/ships";
import { SHIP_TYPE_CODE } from "@/lib/web3/eas";
import { clampScoreSnapshot, type ShipAttestationFields } from "./typed-data";

export type AttestableShip = {
  id: string;
  repo: string;
  shipType: keyof typeof SHIP_TYPE_CODE;
  identifier: string;
  commitSha: string | null;
  shippedAt: Date;
  isPrivate: boolean;
};

/** How long a signature stays usable: long enough to confirm in a wallet. */
export const AUTHORIZATION_TTL_SECONDS = 15 * 60;

/** Why a ship can't be attested, or null when it can. */
export function attestationBlocker(ship: AttestableShip): string | null {
  // An attestation would put the repo name onchain, permanently and publicly.
  if (ship.isPrivate) return "ships from private repos can't be attested";
  if (!hasRealCommitSha(ship)) return "this ship's commit isn't resolved yet, so it can't be attested";
  return null;
}

export function shipAttestationFields(
  ship: AttestableShip,
  builder: { githubLogin: string; score: number },
  deadline: bigint,
): ShipAttestationFields {
  if (!hasRealCommitSha(ship)) throw new Error("ship has no resolved commit");
  return {
    repo: ship.repo,
    shipType: SHIP_TYPE_CODE[ship.shipType],
    identifier: attestationIdentifier(ship),
    commitSha: ship.commitSha,
    timestamp: BigInt(Math.floor(ship.shippedAt.getTime() / 1000)),
    scoreSnapshot: clampScoreSnapshot(builder.score),
    githubLogin: builder.githubLogin,
    shipId: ship.id,
    deadline,
  };
}
