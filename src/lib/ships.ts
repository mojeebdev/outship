type ShipLike = { shipType: "RELEASE" | "MERGE" | "PUSH"; identifier: string; commitSha: string };

const LABELS = { RELEASE: "release", MERGE: "merge", PUSH: "push" } as const;

export function shipLabel(ship: ShipLike): string {
  return LABELS[ship.shipType];
}

// The second line of a ship in a feed: the tag, the PR number, or — for a
// push, whose identifier is only bookkeeping (day + builder) — the short commit.
export function shipDetail(ship: ShipLike): string {
  return ship.shipType === "PUSH" ? ship.commitSha.slice(0, 7) : ship.identifier;
}

// What goes onchain as the attestation's identifier. A push's stored
// identifier carries an internal builder id after the day, which has no
// business in a permanent public record; the commit is attested separately.
export function attestationIdentifier(ship: ShipLike): string {
  return ship.shipType === "PUSH" ? ship.identifier.split(":")[0] : ship.identifier;
}
