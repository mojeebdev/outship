// The EIP-712 message outship signs for a v2 ship attestation, and the schema
// data that carries it. Pure (viem only), so the node tests and the Foundry
// tests can pin the same digest: contracts/src/OutshipShipResolver.sol
// rebuilds exactly this struct in onAttest.
import {
  decodeAbiParameters,
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  encodePacked,
  type Address,
  type Hex,
} from "viem";

export const SHIP_TYPED_DATA_TYPES = {
  Ship: [
    { name: "recipient", type: "address" },
    { name: "attester", type: "address" },
    { name: "repo", type: "string" },
    { name: "shipType", type: "uint8" },
    { name: "identifier", type: "string" },
    { name: "commitSha", type: "string" },
    { name: "timestamp", type: "uint64" },
    { name: "scoreSnapshot", type: "uint16" },
    { name: "githubLogin", type: "string" },
    { name: "shipId", type: "string" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

// Schema v2 in ABI form, in the resolver's decode order.
const SCHEMA_PARAMS = [
  { name: "repo", type: "string" },
  { name: "shipType", type: "uint8" },
  { name: "identifier", type: "string" },
  { name: "commitSha", type: "string" },
  { name: "timestamp", type: "uint64" },
  { name: "scoreSnapshot", type: "uint16" },
  { name: "githubLogin", type: "string" },
  { name: "shipId", type: "string" },
  { name: "deadline", type: "uint64" },
  { name: "outshipSig", type: "bytes" },
] as const;

export type ShipAttestationFields = {
  repo: string;
  shipType: number;
  identifier: string;
  commitSha: string;
  timestamp: bigint;
  scoreSnapshot: number;
  githubLogin: string;
  shipId: string;
  deadline: bigint;
};

export const UINT16_MAX = 65_535;

/** A score as the schema's uint16 can hold it. */
export function clampScoreSnapshot(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(UINT16_MAX, Math.floor(score)));
}

export function shipDomain(chainId: number, resolver: Address) {
  return { name: "outship", version: "1", chainId, verifyingContract: resolver } as const;
}

/** The message for signTypedData. The builder's wallet is recipient and attester. */
export function shipTypedData(
  chainId: number,
  resolver: Address,
  wallet: Address,
  fields: ShipAttestationFields,
) {
  return {
    domain: shipDomain(chainId, resolver),
    types: SHIP_TYPED_DATA_TYPES,
    primaryType: "Ship" as const,
    message: { recipient: wallet, attester: wallet, ...fields },
  };
}

export function shipDigest(
  chainId: number,
  resolver: Address,
  wallet: Address,
  fields: ShipAttestationFields,
): Hex {
  return hashTypedData(shipTypedData(chainId, resolver, wallet, fields));
}

export function encodeShipAttestationData(fields: ShipAttestationFields, outshipSig: Hex): Hex {
  return encodeAbiParameters(SCHEMA_PARAMS, [
    fields.repo,
    fields.shipType,
    fields.identifier,
    fields.commitSha,
    fields.timestamp,
    fields.scoreSnapshot,
    fields.githubLogin,
    fields.shipId,
    fields.deadline,
    outshipSig,
  ]);
}

export function decodeShipAttestationData(
  data: Hex,
): ShipAttestationFields & { outshipSig: Hex } {
  const [repo, shipType, identifier, commitSha, timestamp, scoreSnapshot, githubLogin, shipId, deadline, outshipSig] =
    decodeAbiParameters(SCHEMA_PARAMS, data);
  return { repo, shipType, identifier, commitSha, timestamp, scoreSnapshot, githubLogin, shipId, deadline, outshipSig };
}

/** EAS's schema UID: keccak256(abi.encodePacked(schema, resolver, revocable)). */
export function schemaUid(schema: string, resolver: Address, revocable: boolean): Hex {
  return keccak256(encodePacked(["string", "address", "bool"], [schema, resolver, revocable]));
}
