// Resolves a release's tag to the commit it points at. A release payload's
// target_commitish is often a branch name, which keeps moving; an
// attestation needs the exact commit, so the tag is asked of GitHub with the
// App's installation token (needs the App's "Contents: read" permission).
import type { getDb } from "@/lib/db";
import { installationFetch, type AppCredentials } from "@/lib/github-app-auth";

type Db = Awaited<ReturnType<typeof getDb>>;

const FULL_SHA = /^[0-9a-f]{40}$/;
// Annotated tags can point at other tags; nobody nests more than this.
const MAX_TAG_HOPS = 5;

export const isFullSha = (value: string | null | undefined): value is string =>
  typeof value === "string" && FULL_SHA.test(value);

type GitObject = { object?: { type?: string; sha?: string } };

/** The commit a tag points at, following annotated tags, or null. */
export async function resolveTagCommit(
  credentials: AppCredentials,
  installationId: number,
  repo: string,
  tag: string,
): Promise<string | null> {
  const ref = tag.split("/").map(encodeURIComponent).join("/");
  let response = await installationFetch(installationId, credentials, `/repos/${repo}/git/ref/tags/${ref}`);
  for (let hop = 0; hop <= MAX_TAG_HOPS; hop++) {
    if (!response?.ok) return null;
    const { object } = (await response.json()) as GitObject;
    if (!object?.sha || !isFullSha(object.sha)) return null;
    if (object.type === "commit") return object.sha;
    if (object.type !== "tag") return null;
    // An annotated tag object: follow it to what it tags.
    response = await installationFetch(installationId, credentials, `/repos/${repo}/git/tags/${object.sha}`);
  }
  return null;
}

/**
 * Fills in a release ship's commit if it's still unresolved. Called from the
 * webhook (in waitUntil, right after the ship is stored) and again when its
 * builder tries to attest it, so a transient GitHub error isn't permanent.
 * Returns the commit, or null if it still can't be resolved.
 */
export async function resolveReleaseShipCommit(
  db: Db,
  credentials: AppCredentials,
  ship: { id: string; repo: string; shipType: string; identifier: string; commitSha: string | null },
  installationId?: number,
): Promise<string | null> {
  if (isFullSha(ship.commitSha)) return ship.commitSha;
  if (ship.shipType !== "RELEASE") return null;

  let installation = installationId;
  if (installation === undefined) {
    // Each installation's repos belong to its account, so the repo owner finds it.
    const owner = ship.repo.split("/")[0];
    const row = await db.installation.findFirst({ where: { accountLogin: owner, deletedAt: null } });
    if (!row) return null;
    installation = row.id;
  }

  const sha = await resolveTagCommit(credentials, installation, ship.repo, ship.identifier);
  if (!sha) return null;
  await db.ship.updateMany({ where: { id: ship.id, commitSha: null }, data: { commitSha: sha } });
  return sha;
}
