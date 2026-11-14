// Recomputes every builder's score, current and longest streak and last ship
// date from their stored ships, with the same code the webhook uses
// (scoreBuilder in src/lib/score.ts). Run it after a scoring change, or after
// migrating, so every stored number matches the current rules.
//
// Dry run by default: prints each builder whose numbers would change.
//
//   npm run rescore                       # local D1, dry run
//   npm run rescore -- --remote           # production, dry run
//   npm run rescore -- --remote --apply   # production, write

import { scoreBuilder } from "../src/lib/score.ts";
import { d1, d1Target, sqlString } from "./lib/d1.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const target = d1Target(args);
const now = new Date();

const [builders, ships] = d1(
  `SELECT "id", "githubLogin", "score", "currentStreak", "longestStreak", "lastShipDate" FROM "Builder";
   SELECT "builderId", "shipType", "shippedAt", "weightClass", "releaseHasNotes" FROM "Ship"`,
  target,
);

const shipsByBuilder = new Map();
for (const ship of ships) {
  const list = shipsByBuilder.get(ship.builderId) ?? [];
  list.push({
    shipType: ship.shipType,
    shippedAt: new Date(ship.shippedAt),
    weightClass: ship.weightClass,
    releaseHasNotes: ship.releaseHasNotes === null ? null : Boolean(ship.releaseHasNotes),
  });
  shipsByBuilder.set(ship.builderId, list);
}

const time = (value) => (value ? new Date(value).getTime() : null);
const changes = [];
for (const builder of builders) {
  const next = scoreBuilder(shipsByBuilder.get(builder.id) ?? [], now);
  const differs =
    next.score !== builder.score ||
    next.currentStreak !== builder.currentStreak ||
    next.longestStreak !== builder.longestStreak ||
    time(next.lastShipDate) !== time(builder.lastShipDate);
  if (differs) changes.push({ builder, next });
}

console.log(`${builders.length} builder(s), ${ships.length} ship(s) in ${target === "--remote" ? "production" : "local"} D1\n`);
for (const { builder, next } of changes) {
  const parts = [];
  if (next.score !== builder.score) parts.push(`score ${builder.score} → ${next.score}`);
  if (next.currentStreak !== builder.currentStreak) parts.push(`streak ${builder.currentStreak} → ${next.currentStreak}`);
  if (next.longestStreak !== builder.longestStreak) parts.push(`longest ${builder.longestStreak} → ${next.longestStreak}`);
  if (time(next.lastShipDate) !== time(builder.lastShipDate)) {
    parts.push(`last ship ${builder.lastShipDate ?? "none"} → ${next.lastShipDate?.toISOString() ?? "none"}`);
  }
  console.log(`  ${builder.githubLogin.padEnd(24)} ${parts.join(", ")}`);
}
console.log(`\n${changes.length} builder(s) would change`);

if (changes.length === 0) process.exit(0);
if (!apply) {
  console.log("dry run: nothing written. re-run with --apply to write.");
  process.exit(0);
}

// statsVersion is bumped so a webhook recomputing at the same moment retries
// rather than overwriting this with an older read.
const statements = changes.map(
  ({ builder, next }) =>
    `UPDATE "Builder" SET "score" = ${next.score}, "currentStreak" = ${next.currentStreak}, ` +
    `"longestStreak" = ${next.longestStreak}, "lastShipDate" = ${next.lastShipDate ? sqlString(next.lastShipDate.toISOString()) : "NULL"}, ` +
    `"statsVersion" = "statsVersion" + 1, "updatedAt" = ${sqlString(now.toISOString())} WHERE "id" = ${sqlString(builder.id)}`,
);
for (let i = 0; i < statements.length; i += 50) {
  d1(statements.slice(i, i + 50).join(";\n"), target);
}
console.log(`wrote ${changes.length} builder(s).`);
