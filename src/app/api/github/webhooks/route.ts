import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { verifyGithubSignature } from "@/lib/github-webhook";
import { applyShipToStreak, computeScore, shipPoints } from "@/lib/score";
import { syncInstallation } from "@/lib/installations";
import { postClaimInvite } from "@/lib/claim-invite";

export const dynamic = "force-dynamic";

type ShipType = "RELEASE" | "MERGE" | "PUSH";

type GithubUser = { id: number; login: string; type?: string };

type Repository = {
  owner: { login: string };
  name: string;
  default_branch: string;
  private?: boolean;
  pushed_at?: number | string;
};

// Who a ship is credited to. A push made by a bot (an AI agent's GitHub App,
// say) is credited to the commit's author instead, but only if that author
// already has an outship account, so a bot can never create builders.
type Credit =
  | { kind: "user"; githubId: number; githubLogin: string }
  | { kind: "existing-builder"; githubLogin: string };

type Ship = {
  repo: string;
  shipType: ShipType;
  identifier: string;
  commitSha: string;
  isPrivate: boolean;
  shippedAt: Date;
  credit: Credit;
};

type Db = Awaited<ReturnType<typeof getDb>>;

const isBot = (user: GithubUser) => user.type === "Bot";

const creditUser = (user: GithubUser): Credit => ({
  kind: "user",
  githubId: user.id,
  githubLogin: user.login,
});

function shipFromPayload(
  event: string,
  payload: Record<string, unknown>,
): Ship | null {
  const repository = payload.repository as Repository | undefined;
  if (!repository) return null;
  const repo = `${repository.owner.login}/${repository.name}`;
  const isPrivate = repository.private === true;

  if (event === "release") {
    const release = payload.release as
      | {
          draft: boolean;
          tag_name: string;
          target_commitish: string;
          published_at: string | null;
          created_at: string;
          author: GithubUser;
        }
      | undefined;
    if (payload.action !== "published" || !release || release.draft || isBot(release.author)) {
      return null;
    }
    return {
      repo,
      shipType: "RELEASE",
      identifier: release.tag_name,
      // best effort: release payloads don't always carry a real commit SHA
      commitSha: release.target_commitish,
      isPrivate,
      shippedAt: new Date(release.published_at ?? release.created_at),
      credit: creditUser(release.author),
    };
  }

  if (event === "pull_request") {
    const pr = payload.pull_request as
      | {
          number: number;
          merged: boolean;
          merged_at: string | null;
          merge_commit_sha: string | null;
          base: { ref: string };
          user: GithubUser;
        }
      | undefined;
    if (
      payload.action !== "closed" ||
      !pr?.merged ||
      !pr.merged_at ||
      !pr.merge_commit_sha ||
      pr.base.ref !== repository.default_branch ||
      isBot(pr.user)
    ) {
      return null;
    }
    return {
      repo,
      shipType: "MERGE",
      identifier: String(pr.number),
      commitSha: pr.merge_commit_sha,
      isPrivate,
      shippedAt: new Date(pr.merged_at),
      credit: creditUser(pr.user),
    };
  }

  if (event === "push") {
    const push = payload as {
      ref?: string;
      deleted?: boolean;
      forced?: boolean;
      commits?: { distinct: boolean }[];
      head_commit?: { id: string; author?: { username?: string } } | null;
      sender?: GithubUser;
    };
    // Only new work landing on the default branch: not other branches, not
    // branch deletions, not history rewrites, not re-pushes of known commits.
    if (
      push.ref !== `refs/heads/${repository.default_branch}` ||
      push.deleted ||
      push.forced ||
      !push.head_commit ||
      !push.sender ||
      !(push.commits ?? []).some((commit) => commit.distinct)
    ) {
      return null;
    }

    let credit: Credit;
    if (!isBot(push.sender)) {
      credit = creditUser(push.sender);
    } else if (push.head_commit.author?.username) {
      credit = { kind: "existing-builder", githubLogin: push.head_commit.author.username };
    } else {
      return null;
    }

    // pushed_at is GitHub's clock; commit timestamps are whatever the
    // author's machine said, and can be backdated.
    const pushedAt =
      typeof repository.pushed_at === "number"
        ? new Date(repository.pushed_at * 1000)
        : new Date();

    return {
      repo,
      shipType: "PUSH",
      // The UTC day; the builder is appended once they're resolved.
      identifier: pushedAt.toISOString().slice(0, 10),
      commitSha: push.head_commit.id,
      isPrivate,
      shippedAt: pushedAt,
      credit,
    };
  }

  return null;
}

async function builderPoints(db: Db, builderId: string) {
  const ships = await db.ship.findMany({
    where: { builderId },
    select: { shipType: true, shippedAt: true },
  });
  return shipPoints(ships);
}

async function rescore(db: Db, builderId: string) {
  const builder = await db.builder.findUnique({ where: { id: builderId } });
  if (!builder) return;
  const points = await builderPoints(db, builderId);
  await db.builder.update({
    where: { id: builderId },
    data: { score: computeScore({ points, currentStreak: builder.currentStreak }) },
  });
}

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
  ship: Ship,
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
      for (const otherId of others) await rescore(db, otherId);
    }
  }

  const points = await builderPoints(db, builder.id);
  const streak = applyShipToStreak(
    {
      currentStreak: builder.currentStreak,
      longestStreak: builder.longestStreak,
      lastShipDate: builder.lastShipDate,
    },
    ship.shippedAt,
  );

  await db.builder.update({
    where: { id: builder.id },
    data: {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastShipDate: streak.lastShipDate,
      score: computeScore({ points, currentStreak: streak.currentStreak }),
    },
  });

  if (ship.credit.kind === "user") {
    const installationId = (payload.installation as { id?: number } | undefined)?.id;
    await maybeInviteToClaim(db, env, ctx, builder, ship, installationId).catch((error) =>
      console.warn("claim-invite: skipped", error),
    );
  }

  return Response.json({ ok: true });
}
