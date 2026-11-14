// Pushes every var in .dev.vars to the live Cloudflare Worker as a secret,
// via `wrangler secret put` (one at a time, piped over stdin so multiline
// values like GITHUB_APP_PRIVATE_KEY survive intact).
//
// Run from the repo root, after `wrangler login` on this machine:
//   node scripts/push-secrets.mjs
//
// Keys listed in SKIP are left untouched — add a name here for anything
// you're already managing by hand in the Cloudflare dashboard.

import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SKIP = new Set(["SESSION_SECRET"]);

const vars = parse(readFileSync(".dev.vars", "utf8"));

for (const [key, value] of Object.entries(vars)) {
  if (SKIP.has(key)) {
    console.log(`skipping ${key} (already set)`);
    continue;
  }
  if (!value) {
    console.log(`skipping ${key} (empty in .dev.vars)`);
    continue;
  }

  console.log(`setting ${key}...`);
  const result = spawnSync("npx", ["wrangler", "secret", "put", key], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`failed to set ${key}, stopping`);
    process.exit(result.status ?? 1);
  }
}

console.log("done.");
