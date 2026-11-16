/**
 * Migration 0018: links builders to their live install, unlinks removed ones.
 * Runs every migration before it, then 0018 itself, on SQLite.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const MIGRATIONS = join(process.cwd(), "migrations");
const TARGET = "0018_link_installs.sql";

test("links signed-in builders to their own live install, and unlinks removed installs", () => {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files.filter((f) => f < TARGET)) db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));

  const installation = db.prepare(`INSERT INTO "Installation" ("id", "accountLogin", "accountType", "deletedAt") VALUES (?1, ?2, 'User', ?3)`);
  installation.run(1, "Ada", null); // live, login differs in case
  installation.run(2, "bob", "2026-11-10T00:00:00.000Z"); // removed
  installation.run(3, "cy", null); // live, but cy is linked to another install already
  const builder = db.prepare(
    `INSERT INTO "Builder" ("id", "githubId", "githubLogin", "installationId", "updatedAt") VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)`,
  );
  builder.run("a", 1, "ada", null);
  builder.run("b", 2, "bob", 2);
  builder.run("c", 3, "cy", 99);
  builder.run("d", 4, "dee", null); // no install at all

  db.exec(readFileSync(join(MIGRATIONS, TARGET), "utf8"));
  const linked = Object.fromEntries(
    (db.prepare(`SELECT "id", "installationId" FROM "Builder" ORDER BY "id"`).all() as { id: string; installationId: number | null }[]).map(
      (row) => [row.id, row.installationId],
    ),
  );
  assert.deepEqual(linked, { a: 1, b: null, c: 99, d: null });
});
