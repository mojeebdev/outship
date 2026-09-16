import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { verifyGithubSignature } from "@/lib/github-webhook";
import { applyShipToStreak, computeScore } from "@/lib/score";

export const dynamic = "force-dynamic";

type Ship = {
  repo: string;
  shipType: "RELEASE" | "MERGE";
  identifier: string;
  commitSha: string;
  shippedAt: Date;
  githubId: number;
  githubLogin: string;
};

function shipFromPayload(
  event: string,
  payload: Record<string, unknown>,
): Ship | null {
  const repository = payload.repository as
    | { owner: { login: string }; name: string; default_branch: string }
    | undefined;
  if (!repository) return null;
  const repo = `${repository.owner.login}/${repository.name}`;

  if (event === "release") {
    const release = payload.release as
      | {
          draft: boolean;
          tag_name: string;
          target_commitish: string;
          published_at: string | null;
          created_at: string;
          author: { id: number; login: string };
        }
      | undefined;
    if (payload.action !== "published" || !release || release.draft) {
      return null;
    }
    return {
      repo,
      shipType: "RELEASE",
      identifier: release.tag_name,
      // best effort: release payloads don't always carry a real commit SHA
      commitSha: release.target_commitish,
      shippedAt: new Date(release.published_at ?? release.created_at),
      githubId: release.author.id,
      githubLogin: release.author.login,
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
          user: { id: number; login: string };
        }
      | undefined;
    if (
      payload.action !== "closed" ||
      !pr?.merged ||
      !pr.merged_at ||
      !pr.merge_commit_sha ||
      pr.base.ref !== repository.default_branch
    ) {
      return null;
    }
    return {
      repo,
      shipType: "MERGE",
      identifier: String(pr.number),
      commitSha: pr.merge_commit_sha,
      shippedAt: new Date(pr.merged_at),
      githubId: pr.user.id,
      githubLogin: pr.user.login,
    };
  }

  return null;
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
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

  const ship = shipFromPayload(event, payload);
  if (!ship) {
    return Response.json({ ok: true, skipped: true });
  }

  const db = await getDb();

  const builder = await db.builder.upsert({
    where: { githubId: ship.githubId },
    update: { githubLogin: ship.githubLogin },
    create: { githubId: ship.githubId, githubLogin: ship.githubLogin },
  });

  try {
    await db.ship.create({
      data: {
        builderId: builder.id,
        repo: ship.repo,
        shipType: ship.shipType,
        identifier: ship.identifier,
        commitSha: ship.commitSha,
        shippedAt: ship.shippedAt,
      },
    });
  } catch (error) {
    // unique constraint on [repo, shipType, identifier] — GitHub redelivered
    // a webhook we've already recorded, nothing new to do
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return Response.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  const counts = await db.ship.groupBy({
    by: ["shipType"],
    where: { builderId: builder.id },
    _count: true,
  });
  type ShipCount = { shipType: "RELEASE" | "MERGE"; _count: number };
  const releases =
    (counts as ShipCount[]).find((c) => c.shipType === "RELEASE")?._count ?? 0;
  const merges =
    (counts as ShipCount[]).find((c) => c.shipType === "MERGE")?._count ?? 0;

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
      score: computeScore({ releases, merges, currentStreak: streak.currentStreak }),
    },
  });

  return Response.json({ ok: true });
}
