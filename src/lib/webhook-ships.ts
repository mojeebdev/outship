// Turns a GitHub webhook payload into the ship it represents, if any. Pure:
// no database, no network, so every rule here is covered by tests
// (src/lib/__tests__/webhook-ships.test.ts).
import { isBotLogin } from "@/lib/bots";
import type { WeightClass } from "@/lib/score";

type ShipType = "RELEASE" | "MERGE" | "PUSH";

export type GithubUser = { id: number; login: string; type?: string };

export type Repository = {
  owner: { id?: number; login: string; type?: string };
  name: string;
  default_branch: string;
  private?: boolean;
  language?: string | null;
  pushed_at?: number | string;
};

// author_association values for people inside a repo. Anyone else whose PR
// gets merged made an outside contribution.
const INSIDERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

// Who a ship is credited to. A push made by a bot (an AI agent's GitHub App,
// say) is credited to the commit's author instead, but only if that author
// already has an outship account, so a bot can never create builders.
export type Credit =
  | { kind: "user"; githubId: number; githubLogin: string }
  | { kind: "existing-builder"; githubLogin: string };

export type WebhookShip = {
  repo: string;
  shipType: ShipType;
  identifier: string;
  /** A full SHA, or null for a release whose tag still has to be resolved. */
  commitSha: string | null;
  isPrivate: boolean;
  shippedAt: Date;
  weightClass: WeightClass;
  releaseHasNotes: boolean | null;
  language: string | null;
  credit: Credit;
};


// A bot app, or a bot or AI agent with a user account (src/lib/bots.ts).
const isBot = (user: GithubUser) => user.type === "Bot" || isBotLogin(user.login);

const creditUser = (user: GithubUser): Credit => ({
  kind: "user",
  githubId: user.id,
  githubLogin: user.login,
});

/**
 * A merge is worth more when a second person was involved: someone other
 * than the author merged it, or the author came from outside the repo. The
 * outside test uses GitHub's author_association rather than only comparing
 * with the owner account, so members of an org repo merging their own PRs
 * aren't counted as outsiders.
 */
export function mergeWeightClass(
  pr: { user: GithubUser; merged_by?: GithubUser | null; author_association?: string },
  repository: Repository,
): WeightClass {
  const isOwner = repository.owner.id !== undefined && pr.user.id === repository.owner.id;
  if (!isOwner && pr.author_association && !INSIDERS.has(pr.author_association)) return "EXTERNAL";
  if (pr.merged_by && pr.merged_by.id !== pr.user.id) return "REVIEWED";
  return "STANDARD";
}

export function shipFromPayload(
  event: string,
  payload: Record<string, unknown>,
): WebhookShip | null {
  const repository = payload.repository as Repository | undefined;
  if (!repository) return null;
  const repo = `${repository.owner.login}/${repository.name}`;
  const isPrivate = repository.private === true;
  const language = typeof repository.language === "string" ? repository.language.slice(0, 50) : null;

  if (event === "release") {
    const release = payload.release as
      | {
          draft: boolean;
          tag_name: string;
          target_commitish: string;
          published_at: string | null;
          created_at: string;
          author: GithubUser;
          body?: string | null;
          assets?: unknown[];
        }
      | undefined;
    if (payload.action !== "published" || !release || release.draft || isBot(release.author)) {
      return null;
    }
    return {
      repo,
      shipType: "RELEASE",
      identifier: release.tag_name,
      // target_commitish is usually a branch name; only a full SHA is kept,
      // and the webhook resolves the tag to its commit otherwise.
      commitSha: /^[0-9a-f]{40}$/.test(release.target_commitish) ? release.target_commitish : null,
      isPrivate,
      shippedAt: new Date(release.published_at ?? release.created_at),
      weightClass: "STANDARD",
      // A release with notes or a binary is worth more than a bare tag.
      releaseHasNotes: Boolean(release.body?.trim()) || (release.assets?.length ?? 0) > 0,
      language,
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
          merged_by?: GithubUser | null;
          author_association?: string;
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
      weightClass: mergeWeightClass(pr, repository),
      releaseHasNotes: null,
      language,
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
      weightClass: "STANDARD",
      releaseHasNotes: null,
      language,
      credit,
    };
  }

  return null;
}
