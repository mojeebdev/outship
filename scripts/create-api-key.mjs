// Issues an API v1 key. The key is printed once and never stored: only its
// SHA-256 hash goes in the database. (The admin panel will do the same.)
//
//   node scripts/create-api-key.mjs --name "Acme verify" --owner "Acme Inc" [--contact a@acme.com] [--rate 300] [--remote]
//   node scripts/create-api-key.mjs --revoke os_live_ab12 [--remote]     # by prefix
//
// --local (the default) writes to the local dev database; --remote to production.

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { d1, d1Target, sqlString } from "./lib/d1.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const target = d1Target(args);

const revoke = flag("revoke");
if (revoke) {
  if (!/^os_live_[A-Za-z0-9_-]{4}$/.test(revoke)) {
    console.error("--revoke takes a key prefix like os_live_ab12");
    process.exit(1);
  }
  const [rows] = d1(`SELECT "id", "name", "owner" FROM "ApiKey" WHERE "prefix" = ${sqlString(revoke)} AND "revokedAt" IS NULL`, target);
  if (rows.length !== 1) {
    console.error(`${rows.length} live keys have that prefix; nothing revoked.`);
    process.exit(1);
  }
  d1(`UPDATE "ApiKey" SET "revokedAt" = ${sqlString(new Date().toISOString())} WHERE "id" = ${sqlString(rows[0].id)}`, target);
  console.log(`revoked ${revoke} (${rows[0].name}, ${rows[0].owner}).`);
  process.exit(0);
}

const name = flag("name");
const owner = flag("owner");
const contact = flag("contact") ?? null;
const rate = Number(flag("rate") ?? 120);
if (!name || !owner || !Number.isInteger(rate) || rate < 1) {
  console.error('usage: node scripts/create-api-key.mjs --name "…" --owner "…" [--contact email] [--rate 120] [--remote]');
  process.exit(1);
}

const key = `os_live_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(key).digest("hex");
const prefix = key.slice(0, 12);
d1(
  `INSERT INTO "ApiKey" ("id", "name", "owner", "contact", "prefix", "hash", "ratePerMinute", "createdAt")
   VALUES (${sqlString(randomUUID())}, ${sqlString(name)}, ${sqlString(owner)}, ${contact ? sqlString(contact) : "NULL"},
           ${sqlString(prefix)}, ${sqlString(hash)}, ${rate}, ${sqlString(new Date().toISOString())})`,
  target,
);
console.log(`API key for ${owner} (${name}), ${rate} requests a minute:\n\n  ${key}\n`);
console.log("this is the only time it's shown. send it to them securely; outship keeps only its hash.");
