import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { verifyGithubSignature } from "@/lib/github-webhook";
import { shipFromPayload, type WebhookShip } from "@/lib/webhook-ships";
import { recomputeBuilder } from "@/lib/rescore";
import { syncInstallation } from "@/lib/installations";
import { postClaimInvite } from "@/lib/claim-invite";

export const dynamic = "force-dynamic";

type Db = Awaited<ReturnType<typeof getDb>>;

const skipped = () => Response.json({ ok: true, skipped: true });

/**
 * The one-time claim comment, for a merge credited to someone who has never
 * signed in. claimInvitedAt is claimed with a conditional update before
 * posting (as welcomedAt is for the welcome email), so two deliveries racing
 * can't both post, and nobody is ever invited twice.
 */
async function maybeInviteToClaim(
  db: Db,
  env: CloudflareEnv,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  builder: { id: string; githubLogin: string; claimedAt: Date | null; claimInvitedAt: Date | null },
  ship: WebhookShip,
  installationId: number | undefined,
) {
  if (ship.shipType !== "MERGE" || ship.isPrivate || !installationId) return;
  if (builder.claimedAt || builder.claimInvitedAt) return;

  const installation = await db.installation.findUnique({ where: { id: installationId } });
  if (!installation?.claimInvitesEnabled || installation.deletedAt || installation.suspendedAt) return;

  const { count } = await db.builder.updateMany({
    where: { id: builder.id, claimedAt: null, claimInvitedAt: null },
    data: { claimInvitedAt: new Date() },
  });
  if (count !== 1) return;

  const shipCount = await db.ship.count({ where: { builderId: builder.id, isPrivate: false } });
  ctx.waitUntil(
    postClaimInvite(
      { appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY },
      { installationId, repo: ship.repo, prNumber: Number(ship.identifier), login: builder.githubLogin, shipCount },
    ),
  );
}

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("webhook secret not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const isValid = await verifyGithubSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    secret,
  );
  if (!isValid) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? "";
  const payload = JSON.parse(rawBody) as Record<string, unknown>;

  const db = await getDb();
  await syncInstallation(db, event, payload);
  if (event === "installation" || event === "installation_repositories") {
    return Response.json({ ok: true });
  }

  const ship = shipFromPayload(event, payload);
  if (!ship) return skipped();

  const builder =
    ship.credit.kind === "user"
      ? await db.builder.upsert({
          where: { githubId: ship.credit.githubId },
          update: { githubLogin: ship.credit.githubLogin },
          create: { githubId: ship.credit.githubId, githubLogin: ship.credit.githubLogin },
        })
      : await db.builder.findUnique({ where: { githubLogin: ship.credit.githubLogin } });
  if (!builder) return skipped();

  // A push's identifier is the day it counted for *and* who it counted for:
  // the unique key is [repo, shipType, identifier], so a bare date would let
  // only the first person pushing to a shared repo each day get credit.
  if (ship.shipType === "PUSH") ship.identifier = `${ship.identifier}:${builder.id}`;

  if (ship.shipType === "PUSH") {
    // Landing a merged PR also pushes to the default branch; the PR already
    // counts, and its merge_commit_sha is this push's head commit.
    const asMerge = await db.ship.findFirst({
      where: { shipType: "MERGE", commitSha: ship.commitSha },
      select: { id: true },
    });
    if (asMerge) return skipped();

    // However many pushes, across however many repos: one a day per builder.
    const alreadyToday = await db.ship.findFirst({
      where: { builderId: builder.id, shipType: "PUSH", identifier: ship.identifier },
      select: { id: true },
    });
    if (alreadyToday) return skipped();
  }

  try {
    await db.ship.create({
      data: {
        builderId: builder.id,
        repo: ship.repo,
        shipType: ship.shipType,
        identifier: ship.identifier,
        commitSha: ship.commitSha,
        isPrivate: ship.isPrivate,
        shippedAt: ship.shippedAt,
        weightClass: ship.weightClass,
        releaseHasNotes: ship.releaseHasNotes,
        language: ship.language,
      },
    });
  } catch (error) {
    // unique constraint on [repo, shipType, identifier] — a redelivered
    // webhook, or a second push to the same repo today
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return Response.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  if (ship.shipType === "MERGE") {
    // The push that landed this PR may have arrived first and been counted as
    // a push. The merge supersedes it (unless it was already attested).
    const superseded = await db.ship.findMany({
      where: { shipType: "PUSH", commitSha: ship.commitSha, attestation: { is: null } },
      select: { id: true, builderId: true },
    });
    if (superseded.length > 0) {
      await db.ship.deleteMany({ where: { id: { in: superseded.map((s) => s.id) } } });
      const others = new Set(superseded.map((s) => s.builderId).filter((id) => id !== builder.id));
      for (const otherId of others) await recomputeBuilder(db, otherId);
    }
  }

  // Derived from the stored ships, not incremented: redeliveries,
  // out-of-order events and concurrent webhooks all converge.
  await recomputeBuilder(db, builder.id);

  if (ship.credit.kind === "user") {
    const installationId = (payload.installation as { id?: number } | undefined)?.id;
    await maybeInviteToClaim(db, env, ctx, builder, ship, installationId).catch((error) =>
      console.warn("claim-invite: skipped", error),
    );
  }

  return Response.json({ ok: true });
}
