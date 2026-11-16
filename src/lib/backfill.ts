// The 12-month backfill: when the outship App is installed, import the last
// year of published releases, merged pull requests and commits from the repos
// it can see, so all-time scores reflect real history rather than starting at
// zero.
//
// Releases and merges are scored exactly like live ones (src/lib/score.ts).
// GitHub keeps no push history, so past commits on the default branch stand in
// for pushes: up to PAST_COMMITS_PER_DAY of them a day, each scored as a push,
// and only from before the install (after it, live pushes count). Imported
// ships never trigger a claim comment.
//
// Work is split into jobs (BackfillJob) and done a slice at a time from the
// cron, so a large organisation's history never runs into a Worker's limits.
import type { getDb } from "@/lib/db";
import { installationFetch, privateKeyPemToPkcs8, type AppCredentials } from "@/lib/github-app-auth";
import { recomputeBuilder } from "@/lib/rescore";
import { isBotLogin } from "@/lib/bots";
import { PAST_COMMITS_PER_DAY, type WeightClass } from "@/lib/score";

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

export type JobKind = "REPOS" | "RELEASES" | "PULLS" | "COMMITS";

/** Commits per GitHub page: they're small, so a page can be big. */
export const COMMIT_PAGE_SIZE = 100;

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
  shipType: "RELEASE" | "MERGE" | "PUSH";
  identifier: string;
  commitSha: string | null;
  shippedAt: Date;
  weightClass: WeightClass;
  releaseHasNotes: boolean | null;
};

export type Page = { ships: ImportedShip[]; repo: RepoInfo | null; nextCursor: string | null };

// A person: not a bot app, and not a bot or AI agent posing as a user
// (src/lib/bots.ts).
const user = (actor: Actor) =>
  actor && actor.__typename === "User" && typeof actor.databaseId === "number" && actor.login && !isBotLogin(actor.login)
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

/**
 * One page of the default branch's commits, newest first, already limited by
 * GitHub to the window [since, until). Keeps commits by people (a GitHub
 * account the commit's author email belongs to) and skips merge commits,
 * whose work is already counted through the commits they merge or the PR.
 */
export function parseCommitsPage(json: unknown): Page {
  const repository = (json as { data?: { repository?: Record<string, unknown> | null } })?.data?.repository;
  const repo = repoInfo(repository);
  const history = (
    (repository?.defaultBranchRef as { target?: { history?: unknown } } | null)?.target?.history as
      | { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }; nodes?: Record<string, unknown>[] }
      | undefined
  );
  if (!repo || !history) return { ships: [], repo, nextCursor: null };

  const ships: ImportedShip[] = [];
  for (const node of history.nodes ?? []) {
    const sha = typeof node.oid === "string" ? node.oid : "";
    if (!FULL_SHA.test(sha)) continue;
    if (((node.parents as { totalCount?: number } | null)?.totalCount ?? 1) > 1) continue;
    const committedAt = new Date(String(node.committedDate));
    if (Number.isNaN(committedAt.getTime())) continue;
    const author = user((node.author as { user?: Actor } | null)?.user ?? null);
    if (!author) continue; // no GitHub account behind the email, or a bot
    ships.push({
      githubId: author.id,
      githubLogin: author.login,
      shipType: "PUSH",
      // The day first, like a live push's identifier, so an attestation of
      // either names the day it landed.
      identifier: `${committedAt.toISOString().slice(0, 10)}:${sha}`,
      commitSha: sha,
      shippedAt: committedAt,
      weightClass: "STANDARD",
      releaseHasNotes: null,
    });
  }
  const more = history.pageInfo?.hasNextPage === true;
  return { ships, repo, nextCursor: more ? (history.pageInfo?.endCursor ?? null) : null };
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

export const COMMITS_QUERY = `query($owner: String!, $name: String!, $first: Int!, $after: String, $since: GitTimestamp!, $until: GitTimestamp!) {
  repository(owner: $owner, name: $name) {
    ${REPO_FIELDS}
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: $first, after: $after, since: $since, until: $until) {
            pageInfo { hasNextPage endCursor }
            nodes { oid committedDate parents { totalCount } author { user { __typename login databaseId } } }
          }
        }
      }
    }
  }
}`;

// ── running jobs ─────────────────────────────────────────────────────────────

export type BackfillSummary = {
  queuedInstalls: number;
  jobsRun: number;
  requests: number;
  imported: number;
  failed: number;
  // Why nothing ran, when nothing could. The cron logs the summary, so a
  // misconfigured Worker says so instead of looking like an idle queue.
  skipped?: string;
};

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
    await queueJob(db, installationId, "COMMITS", repo, since);
  }
}

/**
 * Repos queued before commits were imported get a COMMITS job too. Every
 * repo has a PULLS job, so that's the list; the (kind, repo) key makes this
 * a no-op once they all have one.
 */
async function queueMissingCommitJobs(d1: D1Database) {
  await d1
    .prepare(
      `INSERT OR IGNORE INTO "BackfillJob" ("id", "installationId", "kind", "repo", "since", "createdAt", "updatedAt")
       SELECT lower(hex(randomblob(16))), "installationId", 'COMMITS', "repo", "since", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         FROM "BackfillJob" WHERE "kind" = 'PULLS'`,
    )
    .run();
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

  const columns = `"id", "builderId", "repo", "shipType", "identifier", "commitSha", "shippedAt", "createdAt",
             "isPrivate", "weightClass", "releaseHasNotes", "language", "source"`;
  const statements = ships
    .filter((ship) => builderOf.has(ship.githubId))
    .map((ship) =>
      d1
        .prepare(
          ship.shipType === "PUSH"
            ? // A past commit: kept only while the builder has fewer than
              // PAST_COMMITS_PER_DAY imported that day (across repos, since a
              // batch's statements run in order), and never when a merged PR
              // already counts that commit.
              `INSERT OR IGNORE INTO "Ship" (${columns})
               SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'BACKFILL'
                WHERE (SELECT COUNT(*) FROM "Ship" WHERE "builderId" = ?2 AND "shipType" = 'PUSH' AND "source" = 'BACKFILL'
                         AND substr("shippedAt", 1, 10) = substr(?7, 1, 10)) < ${PAST_COMMITS_PER_DAY}
                  AND NOT EXISTS (SELECT 1 FROM "Ship" WHERE "shipType" = 'MERGE' AND "commitSha" = ?6)`
            : `INSERT OR IGNORE INTO "Ship" (${columns})
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
  if (!credentials.appId || !credentials.privateKey) {
    const missing = [!credentials.appId && "GITHUB_APP_ID", !credentials.privateKey && "GITHUB_APP_PRIVATE_KEY"].filter(Boolean);
    return { ...summary, skipped: `missing Worker secret ${missing.join(" and ")}` };
  }
  // A key that can't be read is the Worker's problem, not any job's: skip the
  // run instead of letting every job burn its attempts and park as FAILED,
  // so fixing the secret is enough for the import to carry on.
  try {
    privateKeyPemToPkcs8(credentials.privateKey);
  } catch (error) {
    return { ...summary, skipped: error instanceof Error ? error.message : String(error) };
  }
  summary.queuedInstalls = await queueNewInstallations(db, now);
  await queueMissingCommitJobs(d1);

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
      let page: Page;
      if (job.kind === "COMMITS") {
        // Up to the install: from then on, live pushes count instead.
        const install = await db.installation.findUnique({ where: { id: job.installationId }, select: { createdAt: true } });
        const until = install?.createdAt ?? now;
        const json = await githubJson(credentials, job.installationId, "/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: COMMITS_QUERY,
            variables: { owner, name, first: COMMIT_PAGE_SIZE, after: job.cursor, since: job.since.toISOString(), until: until.toISOString() },
          }),
        });
        page = parseCommitsPage(json);
      } else {
        const query = job.kind === "PULLS" ? PULLS_QUERY : RELEASES_QUERY;
        const json = await githubJson(credentials, job.installationId, "/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { owner, name, first: PAGE_SIZE, after: job.cursor } }),
        });
        page = job.kind === "PULLS" ? parsePullsPage(json, job.since) : parseReleasesPage(json, job.since);
      }
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
