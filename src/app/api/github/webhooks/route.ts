import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { verifyGithubSignature } from "@/lib/github-webhook";
import { shipFromPayload, type WebhookShip } from "@/lib/webhook-ships";
import { recomputeBuilder } from "@/lib/rescore";
import { storeShip } from "@/lib/ship-store";
import { queueRepos } from "@/lib/backfill";
import { syncInstallation } from "@/lib/installations";
import { postClaimInvite } from "@/lib/claim-invite";
import { resolveReleaseShipCommit } from "@/lib/release-commit";

export const dynamic = "force-dynamic";

type Db = Awaited<ReturnType<typeof getDb>>;

const skipped = () => Response.json({ ok: true, skipped: true });

// Events that can produce a ship or change an installation. Anything else the
// App is ever subscribed to is acknowledged without touching the database.
const SHIP_EVENTS = new Set(["release", "pull_request", "push"]);
const INSTALLATION_EVENTS = new Set(["installation", "installation_repositories"]);

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
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    payload = parsed as Record<string, unknown>;
  } catch {
    return new Response("body isn't a JSON object", { status: 400 });
  }

  const db = await getDb();
  const installationId = (payload.installation as { id?: unknown } | undefined)?.id;
  const appInstallationId = typeof installationId === "number" ? installationId : undefined;

  if (INSTALLATION_EVENTS.has(event)) {
    await syncInstallation(db, event, payload);
    // Repos added to an existing install get their year of history too. (A
    // new install is picked up whole by the backfill cron.)
    const added = (payload.repositories_added as { full_name?: string }[] | undefined) ?? [];
    if (event === "installation_repositories" && appInstallationId !== undefined && added.length > 0) {
      await queueRepos(db, appInstallationId, added.map((repo) => repo.full_name).filter((name): name is string => !!name));
    }
    return Response.json({ ok: true });
  }
  if (!SHIP_EVENTS.has(event)) {
    // Still keep the installation row current, but off the response path.
    ctx.waitUntil(syncInstallation(db, event, payload).catch(() => undefined));
    return skipped();
  }
  await syncInstallation(db, event, payload);

  const ship = shipFromPayload(event, payload);
  if (!ship) return skipped();

  let builder;
  if (ship.credit.kind === "user") {
    builder = await db.builder.upsert({
      where: { githubId: ship.credit.githubId },
      update: { githubLogin: ship.credit.githubLogin },
      create: { githubId: ship.credit.githubId, githubLogin: ship.credit.githubLogin },
    });
  } else {
    // A bot's push names its commit author by username, and a commit's author
    // is whatever its email says, so anyone can claim to be anyone there.
    // Only credit it when the builder it names owns this very installation:
    // their bot, pushing into their repos.
    builder = await db.builder.findUnique({ where: { githubLogin: ship.credit.githubLogin } });
    if (!builder || appInstallationId === undefined || builder.installationId !== appInstallationId) {
      return skipped();
    }
  }

  // A push's identifier is the day it counted for *and* who it counted for:
  // the unique key is [repo, shipType, identifier], so a bare date would let
  // only the first person pushing to a shared repo each day get credit.
  if (ship.shipType === "PUSH") ship.identifier = `${ship.identifier}:${builder.id}`;

  if (ship.shipType === "PUSH") {
    // Landing a merged PR also pushes to the default branch; the PR already
    // counts, and its merge_commit_sha is this push's head commit.
    const asMerge = ship.commitSha && await db.ship.findFirst({
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

  const stored = await storeShip(db, builder.id, ship, "WEBHOOK");
  // A redelivered webhook, or a second push to the same repo today.
  if (!stored.stored) return Response.json({ ok: true, duplicate: true });
  for (const otherId of stored.others) await recomputeBuilder(db, otherId);

  // Derived from the stored ships, not incremented: redeliveries,
  // out-of-order events and concurrent webhooks all converge.
  await recomputeBuilder(db, builder.id);

  const credentials = { appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY };
  if (ship.shipType === "RELEASE" && !ship.commitSha && appInstallationId !== undefined) {
    // Resolve the tag to its commit after answering GitHub. Until it resolves
    // (here, or when the builder tries to attest), the ship can't be attested.
    const stored = await db.ship.findUnique({
      where: { repo_shipType_identifier: { repo: ship.repo, shipType: ship.shipType, identifier: ship.identifier } },
    });
    if (stored) {
      ctx.waitUntil(
        resolveReleaseShipCommit(db, credentials, stored, appInstallationId).catch((error) =>
          console.warn("release-commit: unresolved", error),
        ),
      );
    }
  }

  if (ship.credit.kind === "user") {
    await maybeInviteToClaim(db, env, ctx, builder, ship, appInstallationId).catch((error) =>
      console.warn("claim-invite: skipped", error),
    );
  }

  return Response.json({ ok: true });
}
