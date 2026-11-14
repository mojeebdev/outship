// Runs SQL against outship's D1 database through wrangler, for the one-off
// maintenance scripts. `--local` (the default) uses the local dev database,
// `--remote` the production one. Statements go through `wrangler d1 execute`
// with no shell, so nothing is interpolated into a command line.

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const wrangler = join("node_modules", "wrangler", "bin", "wrangler.js");

export function d1Target(args) {
  if (args.includes("--remote")) return "--remote";
  return "--local";
}

/** Runs one or more `;`-separated statements and returns each one's rows. */
export function d1(sql, target) {
  const result = spawnSync(
    process.execPath,
    [wrangler, "d1", "execute", "DB", target, "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute failed:\n${result.stderr || result.stdout}`);
  }
  const parsed = JSON.parse(result.stdout);
  return parsed.map((entry) => entry.results ?? []);
}

/** A single-quoted SQL string literal. */
export function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
