import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Address, Hex } from "viem";
import { getDb } from "@/lib/db";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { consumeRateLimit } from "@/lib/rate-limit";
import { attestationChain } from "@/lib/attest/chain";
import { attestationBlocker, shipAttestationFields } from "@/lib/attest/ship-fields";
import { verifyAttestationTx } from "@/lib/attest/verify";
import { CURRENT_SCHEMA_VERSION, isAttestationConfigured } from "@/lib/web3/eas";

export const dynamic = "force-dynamic";

const HEX_32_BYTES = /^0x[0-9a-fA-F]{64}$/;

// Each call can cost two RPC reads; the client polls while a tx is indexing.
const SAVE_LIMITS = [{ name: "minute", windowSeconds: 60, max: 30 }] as const;

/**
 * Step two: the builder's wallet has submitted the attestation; this stores it,
 * but only after reading the transaction and the attestation back from Base
 * and checking they describe this ship and this builder. The body is just
 * `{ txHash }`: nothing else the browser says is trusted.
 *
 * Idempotent: posting the same transaction again returns the stored row.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shipId: string }> },
) {
  if (!isAttestationConfigured()) {
    return Response.json({ error: "attestations aren't live yet" }, { status: 503 });
  }

  const builder = await getCurrentBuilder();
  if (!builder) return Response.json({ error: "not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { txHash?: unknown } | null;
  const txHash = typeof body?.txHash === "string" ? body.txHash.toLowerCase() : "";
  if (!HEX_32_BYTES.test(txHash)) {
    return Response.json({ error: "txHash must be a 32-byte hex string" }, { status: 400 });
  }

  const { shipId } = await params;
  const db = await getDb();
  const ship = await db.ship.findUnique({ where: { id: shipId }, include: { attestation: true } });
  if (!ship || ship.builderId !== builder.id) {
    return Response.json({ error: "ship not found" }, { status: 404 });
  }

  if (ship.attestation) {
    if (ship.attestation.txHash.toLowerCase() === txHash) {
      return Response.json({ attestation: ship.attestation });
    }
    return Response.json({ error: "ship already attested" }, { status: 409 });
  }

  const blocker = attestationBlocker(ship);
  if (blocker) return Response.json({ error: blocker }, { status: 400 });
  if (!builder.walletAddress) {
    return Response.json({ error: "no wallet linked — start the attestation again" }, { status: 400 });
  }

  const limit = await consumeRateLimit(builder.id, "attest-save", SAVE_LIMITS);
  if (!limit.allowed) {
    return Response.json(
      { error: "too many requests — try again shortly" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  // The deadline and score aren't compared (both are whatever was signed);
  // everything that identifies the ship and the builder is.
  const fields = shipAttestationFields(ship, builder, BigInt(0));
  const { env } = await getCloudflareContext({ async: true });
  const result = await verifyAttestationTx(
    txHash as Hex,
    { ...fields, wallet: builder.walletAddress as Address },
    env.BASE_RPC_URL,
  );
  if (!result.ok) {
    return Response.json({ error: result.error, pending: result.pending ?? false }, { status: result.status });
  }

  try {
    const attestation = await db.attestation.create({
      data: {
        shipId: ship.id,
        easUid: result.uid,
        txHash,
        chain: attestationChain.name,
        scoreSnapshot: result.scoreSnapshot,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      },
    });
    return Response.json({ attestation });
  } catch (error) {
    // Two posts of the same tx racing each other: the unique shipId/easUid
    // index lets one through; the other returns what it stored.
    if (error instanceof Error && (error as { code?: string }).code === "P2002") {
      const existing = await db.attestation.findUnique({ where: { shipId: ship.id } });
      if (existing && existing.txHash.toLowerCase() === txHash) return Response.json({ attestation: existing });
      return Response.json({ error: "ship already attested" }, { status: 409 });
    }
    throw error;
  }
}
