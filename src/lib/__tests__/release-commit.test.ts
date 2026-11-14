/**
 * Tag resolution, with GitHub's API stubbed: a lightweight tag points at a
 * commit, an annotated tag points at a tag object that points at a commit.
 */

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { isFullSha, resolveTagCommit } from "../release-commit";

const credentials = {
  appId: "1",
  privateKey: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
};
const COMMIT = "c".repeat(40);
const TAG_OBJECT = "d".repeat(40);

function stubGithub(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/access_tokens")) {
      return Response.json({ token: "t", expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    }
    const path = url.replace("https://api.github.com", "");
    return path in routes ? Response.json(routes[path]) : new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

test("a lightweight tag resolves straight to its commit", async () => {
  const github = stubGithub({ "/repos/a/b/git/ref/tags/v1.0.0": { object: { type: "commit", sha: COMMIT } } });
  try {
    assert.equal(await resolveTagCommit(credentials, 11, "a/b", "v1.0.0"), COMMIT);
  } finally {
    github.restore();
  }
});

test("an annotated tag is followed to the commit, and slashes in tags survive", async () => {
  const github = stubGithub({
    "/repos/a/b/git/ref/tags/release/v2": { object: { type: "tag", sha: TAG_OBJECT } },
    [`/repos/a/b/git/tags/${TAG_OBJECT}`]: { object: { type: "commit", sha: COMMIT } },
  });
  try {
    assert.equal(await resolveTagCommit(credentials, 12, "a/b", "release/v2"), COMMIT);
  } finally {
    github.restore();
  }
});

test("a missing tag is null, not a guess", async () => {
  const github = stubGithub({});
  try {
    assert.equal(await resolveTagCommit(credentials, 13, "a/b", "nope"), null);
  } finally {
    github.restore();
  }
});

test("only full lowercase SHAs count", () => {
  assert.equal(isFullSha(COMMIT), true);
  assert.equal(isFullSha("main"), false);
  assert.equal(isFullSha(COMMIT.toUpperCase()), false);
  assert.equal(isFullSha(null), false);
});
