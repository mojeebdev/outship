import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getDb } from "@/lib/db";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { consumeRateLimit } from "@/lib/rate-limit";
import { attestationChain } from "@/lib/attest/chain";
import {
  AUTHORIZATION_TTL_SECONDS,
  attestationBlocker,
  shipAttestationFields,
} from "@/lib/attest/ship-fields";
import { encodeShipAttestationData, shipTypedData } from "@/lib/attest/typed-data";
import { resolveReleaseShipCommit } from "@/lib/release-commit";
import { findExistingShipAttestation } from "@/lib/attest/verify";
import {
  CURRENT_SCHEMA_VERSION,
  EAS_CONTRACT_ADDRESS,
  OUTSHIP_RESOLVER_ADDRESS,
  SHIP_ATTESTATION_SCHEMA_UID,
  isAttestationConfigured,
} from "@/lib/web3/eas";

export const dynamic = "force-dynamic";

// Signing is cheap, but each signature is a ticket to one onchain receipt, so
// a builder gets a handful a minute and a few dozen a day.
const AUTHORIZE_LIMITS = [
  { name: "minute", windowSeconds: 60, max: 6 },
  { name: "day", windowSeconds: 86_400, max: 60 },
] as const;

const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;

/**
 * Step one of attesting a ship: outship signs what the attestation will say,
 * built entirely from its own database, and hands back schema data ready for
 * the builder's wallet to submit to EAS. The resolver onchain refuses anything
 * outship didn't sign, so this is where "is this ship real?" gets answered.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shipId: string }> },
) {
  if (!isAttestationConfigured()) {
    return Response.json({ error: "attestations aren't live yet" }, { status: 503 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const privateKey = env.OUTSHIP_ATTESTER_PRIVATE_KEY?.trim();
  if (!privateKey || !PRIVATE_KEY.test(privateKey)) {
    console.error("attest/authorize: OUTSHIP_ATTESTER_PRIVATE_KEY is missing or malformed");
    return Response.json({ error: "attestations aren't configured" }, { status: 503 });
  }

  const builder = await getCurrentBuilder();
  if (!builder) return Response.json({ error: "not signed in" }, { status: 401 });

  const limit = await consumeRateLimit(builder.id, "attest-authorize", AUTHORIZE_LIMITS, { failClosed: true });
  if (!limit.allowed) {
    return Response.json(
      { error: "too many attestation requests — try again shortly" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  const body = (await request.json().catch(() => null)) as { recipient?: unknown } | null;
  const rawRecipient = typeof body?.recipient === "string" ? body.recipient : "";
  // isAddress with strict on rejects a mixed-case address whose checksum is wrong.
  if (!isAddress(rawRecipient, { strict: true })) {
    return Response.json({ error: "recipient must be a checksummed address" }, { status: 400 });
  }
  const recipient = getAddress(rawRecipient);

  const { shipId } = await params;
  const db = await getDb();
  const ship = await db.ship.findUnique({ where: { id: shipId }, include: { attestation: true } });
  if (!ship || ship.builderId !== builder.id) {
    return Response.json({ error: "ship not found" }, { status: 404 });
  }
  if (ship.attestation) return Response.json({ error: "ship already attested" }, { status: 409 });
  if (!ship.isPrivate && ship.shipType === "RELEASE" && !ship.commitSha) {
    // The webhook couldn't resolve this release's tag; try again now.
    const sha = await resolveReleaseShipCommit(
      db,
      { appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY },
      ship,
    ).catch(() => null);
    if (sha) ship.commitSha = sha;
  }
  const blocker = attestationBlocker(ship);
  if (blocker) return Response.json({ error: blocker }, { status: 400 });

  // One wallet per builder. The first attestation links it; after that every
  // receipt has to go to the same address, so a profile's receipts can't be
  // scattered across wallets someone else controls.
  if (builder.walletAddress) {
    if (getAddress(builder.walletAddress) !== recipient) {
      return Response.json(
        {
          error: `your outship profile is linked to ${builder.walletAddress}. switch to that wallet to attest.`,
          code: "wallet_mismatch",
          walletAddress: builder.walletAddress,
        },
        { status: 409 },
      );
    }
  } else {
    const { count } = await db.builder.updateMany({
      where: { id: builder.id, walletAddress: null },
      data: { walletAddress: recipient },
    });
    if (count === 0) {
      // Another request linked a wallet first; it has to be this one.
      const fresh = await db.builder.findUnique({ where: { id: builder.id }, select: { walletAddress: true } });
      if (!fresh?.walletAddress || getAddress(fresh.walletAddress) !== recipient) {
        return Response.json({ error: "a different wallet was just linked to your profile", code: "wallet_mismatch" }, { status: 409 });
      }
    }
  }

  // One ship, one receipt: the resolver refuses a second. If this ship already
  // has one onchain whose save never reached outship, record it now instead.
  const existing = await findExistingShipAttestation(
    ship.id,
    { ...shipAttestationFields(ship, builder, BigInt(0)), wallet: recipient },
    env.BASE_RPC_URL,
  );
  if (existing) {
    if (!existing.ok || !existing.txHash) {
      return Response.json({ error: existing.ok ? "couldn't record the existing receipt" : existing.error }, { status: 409 });
    }
    const attestation = await db.attestation
      .create({
        data: {
          shipId: ship.id,
          easUid: existing.uid,
          txHash: existing.txHash.toLowerCase(),
          chain: attestationChain.name,
          scoreSnapshot: existing.scoreSnapshot,
          schemaVersion: CURRENT_SCHEMA_VERSION,
        },
      })
      .catch(() => db.attestation.findUnique({ where: { shipId: ship.id } }));
    return Response.json({ attestation, recovered: true });
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + AUTHORIZATION_TTL_SECONDS);
  const fields = shipAttestationFields(ship, builder, deadline);
  const signer = privateKeyToAccount(privateKey as Hex);
  const signature = await signer.signTypedData(
    shipTypedData(attestationChain.id, OUTSHIP_RESOLVER_ADDRESS as Address, recipient, fields),
  );

  return Response.json({
    chainId: attestationChain.id,
    eas: EAS_CONTRACT_ADDRESS,
    deadline: Number(deadline),
    request: {
      schema: SHIP_ATTESTATION_SCHEMA_UID,
      data: {
        recipient,
        expirationTime: "0",
        revocable: false,
        refUID: `0x${"0".repeat(64)}`,
        data: encodeShipAttestationData(fields, signature),
        value: "0",
      },
    },
  });
}
