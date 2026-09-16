import { getDb } from "@/lib/db";
import { getCurrentBuilder } from "@/lib/auth/current-builder";

export const dynamic = "force-dynamic";

const HEX_32_BYTES = /^0x[0-9a-fA-F]{64}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shipId: string }> },
) {
  const builder = await getCurrentBuilder();
  if (!builder) {
    return Response.json({ error: "not signed in" }, { status: 401 });
  }

  const { shipId } = await params;

  const body = (await request.json().catch(() => null)) as {
    easUid?: unknown;
    txHash?: unknown;
    chain?: unknown;
  } | null;

  const easUid = typeof body?.easUid === "string" ? body.easUid : "";
  const txHash = typeof body?.txHash === "string" ? body.txHash : "";
  const chain = typeof body?.chain === "string" && body.chain ? body.chain : "base";

  if (!HEX_32_BYTES.test(easUid) || !HEX_32_BYTES.test(txHash)) {
    return Response.json({ error: "invalid attestation payload" }, { status: 400 });
  }

  const db = await getDb();
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    include: { attestation: true },
  });

  if (!ship || ship.builderId !== builder.id) {
    return Response.json({ error: "ship not found" }, { status: 404 });
  }

  if (ship.attestation) {
    return Response.json({ error: "ship already attested" }, { status: 409 });
  }

  const attestation = await db.attestation.create({
    data: {
      shipId: ship.id,
      easUid,
      txHash,
      chain,
      scoreSnapshot: builder.score,
    },
  });

  return Response.json({ attestation });
}
