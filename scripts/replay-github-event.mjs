// Replays a merged PR or a published release that outship missed (for
// example, one that happened before the GitHub App subscribed to that event)
// through outship's real webhook, so it's scored exactly like a live event.
//
// It fetches the PR or release from the GitHub API, wraps it in the payload
// GitHub would have sent, signs it with GITHUB_WEBHOOK_SECRET from .dev.vars,
// and POSTs it to /api/github/webhooks. Safe to run twice: a ship that's
// already recorded comes back as a duplicate and changes nothing.
//
// Run from the repo root:
//   node scripts/replay-github-event.mjs pr mojeebdev/outship 5
//   node scripts/replay-github-event.mjs release mojeebdev/outship v0.1.0
//
// Options:
//   --url <webhook url>   default https://outship.dev/api/github/webhooks
// For a private repo, set GITHUB_TOKEN to a token that can read it.

import { parse } from "dotenv";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const USAGE =
  "usage: node scripts/replay-github-event.mjs <pr|release> <owner/repo> <pr number|tag> [--url <webhook url>]";

const args = process.argv.slice(2);
const urlFlag = args.indexOf("--url");
const webhookUrl =
  urlFlag === -1 ? "https://outship.dev/api/github/webhooks" : args.splice(urlFlag, 2)[1];
const [kind, fullName, ref] = args;

if (!["pr", "release"].includes(kind) || !/^[\w.-]+\/[\w.-]+$/.test(fullName ?? "") || !ref) {
  console.error(USAGE);
  process.exit(1);
}

const secret =
  process.env.GITHUB_WEBHOOK_SECRET ??
  (existsSync(".dev.vars") ? parse(readFileSync(".dev.vars", "utf8")).GITHUB_WEBHOOK_SECRET : undefined);
if (!secret) {
  console.error("GITHUB_WEBHOOK_SECRET not found in .dev.vars or the environment.");
  process.exit(1);
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "outship-replay",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!response.ok) {
    console.error(`GitHub ${path} answered ${response.status}: ${await response.text()}`);
    process.exit(1);
  }
  return response.json();
}

const repository = await github(`/repos/${fullName}`);

let event;
let payload;
if (kind === "pr") {
  const pr = await github(`/repos/${fullName}/pulls/${encodeURIComponent(ref)}`);
  if (!pr.merged_at) {
    console.error(`PR #${pr.number} isn't merged, so it isn't a ship.`);
    process.exit(1);
  }
  event = "pull_request";
  payload = { action: "closed", number: pr.number, pull_request: pr, repository, sender: pr.merged_by ?? pr.user };
} else {
  const release = await github(`/repos/${fullName}/releases/tags/${encodeURIComponent(ref)}`);
  if (release.draft || !release.published_at) {
    console.error(`Release ${release.tag_name} isn't published, so it isn't a ship.`);
    process.exit(1);
  }
  event = "release";
  payload = { action: "published", release, repository, sender: release.author };
}

const body = JSON.stringify(payload);
const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "outship-replay",
    "X-GitHub-Event": event,
    "X-GitHub-Delivery": `replay-${randomUUID()}`,
    "X-Hub-Signature-256": signature,
  },
  body,
});
const text = await response.text();
console.log(`${event} ${fullName} ${ref} -> ${response.status} ${text}`);
if (!response.ok) process.exit(1);
