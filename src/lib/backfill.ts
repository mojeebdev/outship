// The 12-month backfill: when the outship App is installed, import the last
// year of published releases and merged pull requests from the repos it can
// see, so all-time scores reflect real history rather than starting at zero.
//
// Only what GitHub records itself is imported: a release's publish time and a
// PR's merge time are set by GitHub and can't be backdated, unlike commit
// dates. Pushes can't be imported (GitHub keeps no push history); they count
// from install onwards, as before. Imported ships are scored exactly like live
// ones (src/lib/score.ts) and never trigger a claim comment.
//
// Work is split into jobs (BackfillJob) and done a slice at a time from the
// cron, so a large organisation's history never runs into a Worker's limits.
import type { getDb } from "@/lib/db";
import { installationFetch, type AppCredentials } from "@/lib/github-app-auth";
import { recomputeBuilder } from "@/lib/rescore";
import type { WeightClass } from "@/lib/score";

type Db = Awaited<ReturnType<typeof getDb>>;

export const BACKFILL_DAYS = 365;
/** Items per GitHub page. Small enough that one page is one D1 batch. */
export const PAGE_SIZE = 25;
/** GitHub requests per run, under the free plan's 50 subrequests. */
export const DEFAULT_REQUEST_BUDGET = 12;
/** A job that keeps failing is parked after this many tries. */
export const MAX_ATTEMPTS = 5;

const INSIDERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const FULL_SHA = /^[0-9a-f]{40}$/;

export type JobKind = "REPOS" | "RELEASES" | "PULLS";

// ── parsing GitHub's answers (pure) ─────────────────────────────────────────

type Actor = { __typename?: string; login?: string; databaseId?: number | null } | null;

export type RepoInfo = {
  private: boolean;
  defaultBranch: string | null;
  language: string | null;
  ownerId: number | null;
};

export type ImportedShip = {
  githubId: number;
  githubLogin: string;
  shipType: "RELEASE" | "MERGE";
  identifier: string;
  commitSha: string | null;
  shippedAt: Date;
  weightClass: WeightClass;
  releaseHasNotes: boolean | null;
};

export type Page = { ships: ImportedShip[]; repo: RepoInfo | null; nextCursor: string | null };

const user = (actor: Actor) =>
  actor && actor.__typename === "User" && typeof actor.databaseId === "number" && actor.login
    ? { id: actor.databaseId, login: actor.login }
    : null;

function repoInfo(repository: Record<string, unknown> | null | undefined): RepoInfo | null {
  if (!repository) return null;
  const owner = repository.owner as Actor;
  return {
    private: repository.isPrivate === true,
    defaultBranch: (repository.defaultBranchRef as { name?: string } | null)?.name ?? null,
    language: ((repository.primaryLanguage as { name?: string } | null)?.name ?? null)?.slice(0, 50) ?? null,
    ownerId: typeof owner?.databaseId === "number" ? owner.databaseId : null,
  };
}

/** The same rule as live merges (mergeWeightClass in webhook-ships.ts). */
export function importedMergeWeight(
  author: { id: number },
  mergedBy: { id: number } | null,
  association: string | undefined,
  ownerId: number | null,
): WeightClass {
  const isOwner = ownerId !== null && author.id === ownerId;
  if (!isOwner && association && !INSIDERS.has(association)) return "EXTERNAL";
  if (mergedBy && mergedBy.id !== author.id) return "REVIEWED";
  return "STANDARD";
}

/**
 * One page of merged PRs, newest activity first. Keeps PRs merged into the
 * default branch since `since` by people (not bots). Stops paging once PRs
 * were last updated before `since`: a PR's merge can't be newer than its
 * last update.
 */
export function parsePullsPage(json: unknown, since: Date): Page {
  const repository = (json as { data?: { repository?: Record<string, unknown> | null } })?.data?.repository;
  const repo = repoInfo(repository);
  const connection = repository?.pullRequests as
    | { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: Record<string, unknown>[] }
    | undefined;
  if (!repo || !connection) return { ships: [], repo, nextCursor: null };

  const ships: ImportedShip[] = [];
  let reachedOld = false;
  for (const node of connection.nodes ?? []) {
    const updatedAt = new Date(String(node.updatedAt));
    if (updatedAt < since) reachedOld = true;
    const mergedAt = node.mergedAt ? new Date(String(node.mergedAt)) : null;
    if (!mergedAt || mergedAt < since || Number.isNaN(mergedAt.getTime())) continue;
    if (repo.defaultBranch && node.baseRefName !== repo.defaultBranch) continue;
    const author = user(node.author as Actor);
    if (!author) continue; // a bot, or a deleted account
    const sha = (node.mergeCommit as { oid?: string } | null)?.oid ?? null;
    ships.push({
      githubId: author.id,
      githubLogin: author.login,
      shipType: "MERGE",
      identifier: String(node.number),
      commitSha: sha && FULL_SHA.test(sha) ? sha : null,
      shippedAt: mergedAt,
      weightClass: importedMergeWeight(author, user(node.mergedBy as Actor), node.authorAssociation as string, repo.ownerId),
      releaseHasNotes: null,
    });
  }
  const more = connection.pageInfo?.hasNextPage === true && !reachedOld;
  return { ships, repo, nextCursor: more ? (connection.pageInfo?.endCursor ?? null) : null };
}

/** One page of releases, newest first; published, by people, since `since`. */
export function parseReleasesPage(json: unknown, since: Date): Page {
  const repository = (json as { data?: { repository?: Record<string, unknown> | null } })?.data?.repository;
  const repo = repoInfo(repository);
  const connection = repository?.releases as
    | { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: Record<string, unknown>[] }
    | undefined;
  if (!repo || !connection) return { ships: [], repo, nextCursor: null };

  const ships: ImportedShip[] = [];
  let reachedOld = false;
  for (const node of connection.nodes ?? []) {
    if (new Date(String(node.createdAt)) < since) reachedOld = true;
    if (node.isDraft || !node.publishedAt) continue;
    const publishedAt = new Date(String(node.publishedAt));
    if (publishedAt < since || Number.isNaN(publishedAt.getTime())) continue;
    const author = user(node.author as Actor);
    if (!author || typeof node.tagName !== "string") continue;
    const sha = (node.tagCommit as { oid?: string } | null)?.oid ?? null;
    const assets = (node.releaseAssets as { totalCount?: number } | null)?.totalCount ?? 0;
    ships.push({
      githubId: author.id,
      githubLogin: author.login,
      shipType: "RELEASE",
      identifier: node.tagName,
      commitSha: sha && FULL_SHA.test(sha) ? sha : null,
      shippedAt: publishedAt,
      weightClass: "STANDARD",
      releaseHasNotes: Boolean(String(node.description ?? "").trim()) || assets > 0,
    });
  }
  const more = connection.pageInfo?.hasNextPage === true && !reachedOld;
  return { ships, repo, nextCursor: more ? (connection.pageInfo?.endCursor ?? null) : null };
}

const REPO_FIELDS = `isPrivate defaultBranchRef { name } primaryLanguage { name }
  owner { __typename login ... on User { databaseId } ... on Organization { databaseId } }`;
const ACTOR = `{ __typename login ... on User { databaseId } }`;

export const PULLS_QUERY = `query($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    ${REPO_FIELDS}
    pullRequests(states: MERGED, first: $first, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { number mergedAt updatedAt baseRefName authorAssociation mergeCommit { oid } author ${ACTOR} mergedBy ${ACTOR} }
    }
  }
}`;

export const RELEASES_QUERY = `query($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    ${REPO_FIELDS}
    releases(first: $first, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { tagName isDraft publishedAt createdAt description releaseAssets { totalCount } tagCommit { oid } author ${ACTOR} }
    }
  }
}`;

// ── running jobs ─────────────────────────────────────────────────────────────

export type BackfillSummary = { queuedInstalls: number; jobsRun: number; requests: number; imported: number; failed: number };

class GithubError extends Error {
  readonly permanent: boolean;
  constructor(message: string, permanent: boolean) {
    super(message);
    this.permanent = permanent;
  }
}

async function githubJson(
  credentials: AppCredentials,
  installationId: number,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await installationFetch(installationId, credentials, path, init);
  if (!response) throw new GithubError("no installation token (App not configured, or the install is gone)", true);
  // 401/403/404: the install was removed or can't see this repo; retrying won't help.
  if ([401, 403, 404].includes(response.status)) throw new GithubError(`GitHub answered ${response.status}`, true);
  if (!response.ok) throw new GithubError(`GitHub answered ${response.status}`, false);
  const json = (await response.json()) as { errors?: { type?: string; message?: string }[] };
  if (json.errors?.length) {
    const notFound = json.errors.some((error) => error.type === "NOT_FOUND");
    throw new GithubError(json.errors.map((error) => error.message).join("; "), notFound);
  }
  return json;
}

/** Queue a REPOS job for every live installation that hasn't been backfilled. */
async function queueNewInstallations(db: Db, now: Date): Promise<number> {
  const installs = await db.installation.findMany({
    where: { backfillQueuedAt: null, deletedAt: null, suspendedAt: null },
    select: { id: true },
  });
  const since = new Date(now.getTime() - BACKFILL_DAYS * 86_400_000);
  for (const install of installs) {
    await queueJob(db, install.id, "REPOS", `installation:${install.id}`, since);
    await db.installation.update({ where: { id: install.id }, data: { backfillQueuedAt: now } });
  }
  return installs.length;
}

/** Queue a job once per (kind, repo); a repo seen again later is left as it is. */
export async function queueJob(db: Db, installationId: number, kind: JobKind, repo: string, since: Date) {
  await db.backfillJob.upsert({
    where: { kind_repo: { kind, repo } },
    update: {},
    create: { installationId, kind, repo, since },
  });
}

/** Queue both history jobs for repos an installation just gained. */
export async function queueRepos(db: Db, installationId: number, repos: string[], now = new Date()) {
  const since = new Date(now.getTime() - BACKFILL_DAYS * 86_400_000);
  for (const repo of repos) {
    await queueJob(db, installationId, "RELEASES", repo, since);
    await queueJob(db, installationId, "PULLS", repo, since);
  }
}

/**
 * Writes one page of imported ships in a single D1 batch: builders (created
 * unclaimed if new, as the live webhook does), then the ships, each ignored if
 * already recorded. Returns the builders whose ships changed.
 */
async function writePage(d1: D1Database, repo: string, info: RepoInfo, ships: ImportedShip[], now: Date) {
  if (ships.length === 0) return { builderIds: [] as string[], inserted: 0 };
  const stamp = now.toISOString();
  const logins = new Map(ships.map((ship) => [ship.githubId, ship.githubLogin]));
  await d1.batch(
    [...logins].map(([githubId, login]) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO "Builder" ("id", "githubId", "githubLogin", "createdAt", "updatedAt") VALUES (?1, ?2, ?3, ?4, ?4)`,
        )
        .bind(crypto.randomUUID(), githubId, login, stamp),
    ),
  );
  const ids = [...logins.keys()];
  const { results: builders } = await d1
    .prepare(`SELECT "id", "githubId" FROM "Builder" WHERE "githubId" IN (${ids.map((_, i) => `?${i + 1}`).join(", ")})`)
    .bind(...ids)
    .all<{ id: string; githubId: number }>();
  const builderOf = new Map(builders.map((row) => [Number(row.githubId), row.id]));

  const statements = ships
    .filter((ship) => builderOf.has(ship.githubId))
    .map((ship) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO "Ship" ("id", "builderId", "repo", "shipType", "identifier", "commitSha", "shippedAt", "createdAt",
             "isPrivate", "weightClass", "releaseHasNotes", "language", "source")
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'BACKFILL')`,
        )
        .bind(
          crypto.randomUUID(),
          builderOf.get(ship.githubId)!,
          repo,
          ship.shipType,
          ship.identifier,
          ship.commitSha,
          ship.shippedAt.toISOString(),
          stamp,
          info.private ? 1 : 0,
          ship.weightClass,
          ship.releaseHasNotes === null ? null : ship.releaseHasNotes ? 1 : 0,
          info.language,
        ),
    );
  const inserts = statements.length;
  // A merge supersedes a push that landed it, as with live ships.
  const mergeShas = ships.filter((ship) => ship.shipType === "MERGE" && ship.commitSha).map((ship) => ship.commitSha!);
  if (mergeShas.length > 0) {
    statements.push(
      d1
        .prepare(
          `DELETE FROM "Ship" WHERE "shipType" = 'PUSH' AND "commitSha" IN (${mergeShas.map((_, i) => `?${i + 1}`).join(", ")})
             AND "id" NOT IN (SELECT "shipId" FROM "Attestation")`,
        )
        .bind(...mergeShas),
    );
  }
  const results = await d1.batch(statements);
  const inserted = results.slice(0, inserts).reduce((sum, result) => sum + (result.meta.changes ?? 0), 0);
  return { builderIds: [...new Set(builders.map((row) => row.id))], inserted };
}

/**
 * Does one slice of backfill work: queues new installations, then runs jobs
 * oldest first until the GitHub request budget is spent. Safe to run often
 * and concurrently-ish: every write is idempotent.
 */
export async function runBackfill(
  db: Db,
  d1: D1Database,
  credentials: AppCredentials,
  { budget = DEFAULT_REQUEST_BUDGET, now = new Date() }: { budget?: number; now?: Date } = {},
): Promise<BackfillSummary> {
  const summary: BackfillSummary = { queuedInstalls: 0, jobsRun: 0, requests: 0, imported: 0, failed: 0 };
  if (!credentials.appId || !credentials.privateKey) return summary;
  summary.queuedInstalls = await queueNewInstallations(db, now);

  const touched = new Set<string>();
  while (summary.requests < budget) {
    // REPOS first, so a new install's repos are queued before anything else.
    const job =
      (await db.backfillJob.findFirst({ where: { status: "PENDING", kind: "REPOS" }, orderBy: { createdAt: "asc" } })) ??
      (await db.backfillJob.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }));
    if (!job) break;
    summary.jobsRun++;
    summary.requests++;
    try {
      if (job.kind === "REPOS") {
        const page = Number(job.cursor ?? 1);
        const json = (await githubJson(
          credentials,
          job.installationId,
          `/installation/repositories?per_page=100&page=${page}`,
        )) as { total_count?: number; repositories?: { full_name: string }[] };
        const repos = (json.repositories ?? []).map((repo) => repo.full_name);
        await queueRepos(db, job.installationId, repos, now);
        const done = repos.length < 100;
        await db.backfillJob.update({
          where: { id: job.id },
          data: {
            cursor: done ? null : String(page + 1),
            imported: { increment: repos.length },
            ...(done ? { status: "DONE", finishedAt: now } : {}),
          },
        });
        continue;
      }

      const [owner, name] = job.repo.split("/");
      const query = job.kind === "PULLS" ? PULLS_QUERY : RELEASES_QUERY;
      const json = await githubJson(credentials, job.installationId, "/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { owner, name, first: PAGE_SIZE, after: job.cursor } }),
      });
      const page = job.kind === "PULLS" ? parsePullsPage(json, job.since) : parseReleasesPage(json, job.since);
      if (!page.repo) throw new GithubError("repository not found", true);
      const written = await writePage(d1, job.repo, page.repo, page.ships, now);
      for (const id of written.builderIds) touched.add(id);
      summary.imported += written.inserted;
      await db.backfillJob.update({
        where: { id: job.id },
        data: {
          cursor: page.nextCursor,
          imported: { increment: written.inserted },
          attempts: 0,
          ...(page.nextCursor ? {} : { status: "DONE", finishedAt: now }),
        },
      });
    } catch (error) {
      const permanent = error instanceof GithubError && error.permanent;
      const attempts = job.attempts + 1;
      const failed = permanent || attempts >= MAX_ATTEMPTS;
      if (failed) summary.failed++;
      await db.backfillJob.update({
        where: { id: job.id },
        data: {
          attempts,
          error: String(error instanceof Error ? error.message : error).slice(0, 500),
          ...(failed ? { status: "FAILED", finishedAt: now } : {}),
        },
      });
      // A transient error: leave it for the next run rather than spin on it.
      if (!failed) break;
    }
  }

  // Scores and streaks are derived from ships, so rescoring the builders who
  // gained imported ships is all that's needed.
  for (const id of touched) await recomputeBuilder(db, id, now);
  return summary;
}
