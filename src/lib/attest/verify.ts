// Checks that a transaction really put a v2 attestation for a given ship on
// Base before outship stores it. The browser only ever tells the server a tx
// hash; everything else is read back from the chain.
import { getAddress, parseEventLogs, type Address, type Hex } from "viem";
import { EAS_ABI } from "@/lib/web3/eas-abi";
import { EAS_CONTRACT_ADDRESS, SHIP_ATTESTATION_SCHEMA_UID } from "@/lib/web3/eas";
import { attestationPublicClient } from "./chain";
import { decodeShipAttestationData, type ShipAttestationFields } from "./typed-data";

export type OnchainAttestation = {
  uid: Hex;
  schema: Hex;
  recipient: Address;
  attester: Address;
  expirationTime: bigint;
  revocationTime: bigint;
  data: Hex;
};

export type ExpectedShip = Pick<
  ShipAttestationFields,
  "repo" | "shipType" | "identifier" | "commitSha" | "timestamp" | "githubLogin" | "shipId"
> & { wallet: Address };

export type VerifyResult =
  | { ok: true; uid: Hex; scoreSnapshot: number }
  | { ok: false; status: number; error: string; pending?: boolean };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The pure half: does this onchain attestation describe this ship, for this
 * builder, under schema v2? Returns the reason it doesn't, or null.
 */
export function attestationMismatch(
  onchain: OnchainAttestation,
  expected: ExpectedShip,
  schemaUid: string = SHIP_ATTESTATION_SCHEMA_UID,
): string | null {
  if (!schemaUid || !same(onchain.schema, schemaUid)) return "not an outship v2 attestation";
  if (onchain.revocationTime !== BigInt(0)) return "attestation was revoked";
  if (onchain.expirationTime !== BigInt(0)) return "attestation expires";
  if (getAddress(onchain.recipient) !== getAddress(expected.wallet)) return "recipient isn't your linked wallet";
  if (getAddress(onchain.attester) !== getAddress(expected.wallet)) return "attester isn't your linked wallet";

  let decoded: ReturnType<typeof decodeShipAttestationData>;
  try {
    decoded = decodeShipAttestationData(onchain.data);
  } catch {
    return "attestation data doesn't decode";
  }
  const checks: [keyof ExpectedShip, unknown, unknown][] = [
    ["shipId", decoded.shipId, expected.shipId],
    ["repo", decoded.repo, expected.repo],
    ["commitSha", decoded.commitSha, expected.commitSha],
    ["githubLogin", decoded.githubLogin, expected.githubLogin],
    ["shipType", decoded.shipType, expected.shipType],
    ["identifier", decoded.identifier, expected.identifier],
    ["timestamp", decoded.timestamp, expected.timestamp],
  ];
  for (const [field, actual, wanted] of checks) {
    if (actual !== wanted) return `attestation ${field} doesn't match this ship`;
  }
  return null;
}

/** The I/O half: fetch the receipt and the attestation, then check them. */
export async function verifyAttestationTx(
  txHash: Hex,
  expected: ExpectedShip,
  rpcUrl: string | undefined,
): Promise<VerifyResult> {
  const client = attestationPublicClient(rpcUrl);

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    // Not indexed yet by this RPC, or not mined. The client retries.
    return { ok: false, status: 202, pending: true, error: "transaction not found yet" };
  }
  if (receipt.status !== "success") return { ok: false, status: 400, error: "transaction failed onchain" };

  const attested = parseEventLogs({ abi: EAS_ABI, eventName: "Attested", logs: receipt.logs }).find(
    (log) => same(log.address, EAS_CONTRACT_ADDRESS) && same(log.args.schemaUID, SHIP_ATTESTATION_SCHEMA_UID),
  );
  if (!attested) return { ok: false, status: 400, error: "no outship attestation in that transaction" };

  const onchain = await client.readContract({
    address: EAS_CONTRACT_ADDRESS,
    abi: EAS_ABI,
    functionName: "getAttestation",
    args: [attested.args.uid],
  });
  if (onchain.uid !== attested.args.uid) return { ok: false, status: 400, error: "attestation not found onchain" };

  const mismatch = attestationMismatch(onchain, expected);
  if (mismatch) return { ok: false, status: 400, error: mismatch };

  return { ok: true, uid: onchain.uid, scoreSnapshot: decodeShipAttestationData(onchain.data).scoreSnapshot };
}
