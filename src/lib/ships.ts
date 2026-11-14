type ShipLike = { shipType: "RELEASE" | "MERGE" | "PUSH"; identifier: string; commitSha: string | null };

const LABELS = { RELEASE: "release", MERGE: "merge", PUSH: "push" } as const;

export function shipLabel(ship: ShipLike): string {
  return LABELS[ship.shipType];
}

// The second line of a ship in a feed: the tag, "PR #12", or — for a
// push, whose identifier is only bookkeeping (day + builder) — the short commit.
export function shipDetail(ship: ShipLike): string {
  if (ship.shipType === "PUSH") return ship.commitSha?.slice(0, 7) ?? "commit unknown";
  if (ship.shipType === "MERGE") return `PR #${ship.identifier}`;
  return ship.identifier;
}

// What goes onchain as the attestation's identifier. A push's stored
// identifier carries an internal builder id after the day, which has no
// business in a permanent public record; the commit is attested separately.
export function attestationIdentifier(ship: ShipLike): string {
  return ship.shipType === "PUSH" ? ship.identifier.split(":")[0] : ship.identifier;
}

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;

/**
 * Whether a stored commit is a real 40-character SHA. Only those can be
 * attested: a release's target_commitish can be a branch name, which would put
 * a moving pointer into a permanent record.
 */
export function hasRealCommitSha(ship: { commitSha: string | null }): ship is { commitSha: string } {
  return ship.commitSha !== null && FULL_COMMIT_SHA.test(ship.commitSha);
}
