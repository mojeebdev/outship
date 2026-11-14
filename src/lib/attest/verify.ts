// Checks that a transaction really put a v2 attestation for a given ship on
// Base before outship stores it. The browser only ever tells the server a tx
// hash; everything else is read back from the chain.
import { getAddress, keccak256, parseEventLogs, toBytes, zeroHash, type Address, type Hex } from "viem";
import { EAS_ABI, RESOLVER_ABI } from "@/lib/web3/eas-abi";
import { EAS_CONTRACT_ADDRESS, OUTSHIP_RESOLVER_ADDRESS, SHIP_ATTESTATION_SCHEMA_UID } from "@/lib/web3/eas";
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

// Base produces a block every two seconds, on mainnet and Sepolia alike.
const BASE_BLOCK_SECONDS = 2;
// Base's public RPC answers eth_getLogs over at most 200 blocks, so the log is
// looked for in 200-block chunks, nearest the estimate first, out to about
// half an hour either side (Base's blocks are exactly two seconds apart, so
// it is almost always in the first chunk).
const LOG_CHUNK = BigInt(199);
const LOG_CHUNKS_EACH_WAY = 5;

/** Roughly which block was current at `time`, counting back from the latest block. */
export function estimateBlockAt(latestNumber: bigint, latestTime: bigint, time: bigint): bigint {
  if (time >= latestTime) return latestNumber;
  const back = (latestTime - time) / BigInt(BASE_BLOCK_SECONDS);
  return back >= latestNumber ? BigInt(0) : latestNumber - back;
}

/**
 * The resolver keeps one attestation per ship. If this ship already has one
 * onchain (say the builder attested, then closed the tab before outship's
 * save ran), find it, check it like a normal save, and return it with its
 * transaction, so it can be stored instead of being signed for again, which
 * the resolver would refuse anyway. Null when the ship has no receipt yet.
 */
export async function findExistingShipAttestation(
  shipId: string,
  expected: ExpectedShip,
  rpcUrl: string | undefined,
): Promise<(VerifyResult & { txHash?: Hex }) | null> {
  const client = attestationPublicClient(rpcUrl);
  const uid = await client.readContract({
    address: OUTSHIP_RESOLVER_ADDRESS as Address,
    abi: RESOLVER_ABI,
    functionName: "attestationForShip",
    args: [keccak256(toBytes(shipId))],
  });
  if (uid === zeroHash) return null;

  const onchain = await client.readContract({
    address: EAS_CONTRACT_ADDRESS,
    abi: EAS_ABI,
    functionName: "getAttestation",
    args: [uid],
  });
  const mismatch = attestationMismatch(onchain, expected);
  if (mismatch) return { ok: false, status: 409, error: `this ship already has an onchain receipt, but ${mismatch}` };

  // EAS stores the time, not the transaction: look for the Attested log near it.
  const latest = await client.getBlock();
  const around = estimateBlockAt(latest.number, latest.timestamp, onchain.time);
  const half = LOG_CHUNK / BigInt(2);
  const windows: [bigint, bigint][] = [[around - half, around + half]];
  for (let i = 1; i <= LOG_CHUNKS_EACH_WAY; i++) {
    const offset = LOG_CHUNK * BigInt(i);
    windows.push([around - half - offset, around - half - offset + LOG_CHUNK - BigInt(1)]);
    windows.push([around + half + offset - LOG_CHUNK + BigInt(1), around + half + offset]);
  }
  let log: { transactionHash: Hex } | undefined;
  for (const [from, to] of windows) {
    const fromBlock = from < BigInt(0) ? BigInt(0) : from;
    const toBlock = to > latest.number ? latest.number : to;
    if (fromBlock > toBlock) continue;
    const logs = await client
      .getContractEvents({
        address: EAS_CONTRACT_ADDRESS,
        abi: EAS_ABI,
        eventName: "Attested",
        args: { recipient: onchain.recipient, attester: onchain.attester, schemaUID: onchain.schema },
        fromBlock,
        toBlock,
      })
      .catch(() => []);
    log = logs.find((entry) => entry.args.uid === uid);
    if (log) break;
  }
  if (!log) return { ok: false, status: 409, error: "this ship already has an onchain receipt; outship couldn't find its transaction yet" };

  return {
    ok: true,
    uid,
    scoreSnapshot: decodeShipAttestationData(onchain.data).scoreSnapshot,
    txHash: log.transactionHash,
  };
}
