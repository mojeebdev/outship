// Pushes every runtime secret in .dev.vars to the live Cloudflare Worker via
// `wrangler secret put`, one at a time over stdin so multiline values like
// GITHUB_APP_PRIVATE_KEY survive intact.
//
// Run from the repo root, after `wrangler login` on this machine:
//   node scripts/push-secrets.mjs
//
// Skipped on purpose:
// - SKIP: secrets you already manage by hand in the Cloudflare dashboard.
// - NEXT_PUBLIC_*: these are inlined into the client bundle at *build* time,
//   so a runtime secret does nothing for them. Set them as build variables
//   (Workers Builds -> Settings -> Build -> Variables and secrets).

import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const SKIP = new Set(["SESSION_SECRET"]);

// Run wrangler's entrypoint with node directly: no shell, so nothing about a
// key name or value is ever interpolated into a command line.
const wrangler = join("node_modules", "wrangler", "bin", "wrangler.js");

const vars = parse(readFileSync(".dev.vars", "utf8"));

for (const [key, value] of Object.entries(vars)) {
  if (SKIP.has(key)) {
    console.log(`skipping ${key} (already set)`);
    continue;
  }
  if (key.startsWith("NEXT_PUBLIC_")) {
    console.log(`skipping ${key} (build-time variable, not a runtime secret)`);
    continue;
  }
  if (!value) {
    console.log(`skipping ${key} (empty in .dev.vars)`);
    continue;
  }

  console.log(`setting ${key}...`);
  const result = spawnSync(process.execPath, [wrangler, "secret", "put", key], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  });

  if (result.status !== 0) {
    console.error(`failed to set ${key}, stopping`);
    process.exit(result.status ?? 1);
  }
}

console.log("done.");
