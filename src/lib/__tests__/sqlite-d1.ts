// For tests: SQLite built from the real migrations, behind a small D1-shaped
// wrapper (prepare/bind/all/run/first/batch), plus a fake EMAIL binding.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = join(process.cwd(), "migrations");

export function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  return db;
}

export function d1(db: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    const statement = db.prepare(sql);
    const bound = (args: unknown[]) => ({
      bind: (...more: unknown[]) => bound([...args, ...more]),
      all: async () => ({ results: statement.all(...(args as never[])) }),
      first: async () => statement.get(...(args as never[])) ?? null,
      run: async () => ({ meta: { changes: Number(statement.run(...(args as never[])).changes) } }),
    });
    return bound([]);
  };
  return { prepare } as unknown as D1Database;
}

export type SentEmail = { to: string; from: string; fromName: string; subject: string; text: string; replyTo?: string; headers?: Record<string, string> };

export function fakeEmail(fail?: string) {
  const sent: SentEmail[] = [];
  const binding = {
    async send(message: {
      to: string;
      from: { email: string; name: string };
      replyTo?: { email: string };
      subject: string;
      text: string;
      headers?: Record<string, string>;
    }) {
      if (fail) throw Object.assign(new Error(fail), { code: fail });
      sent.push({
        to: message.to,
        from: message.from.email,
        fromName: message.from.name,
        subject: message.subject,
        text: message.text,
        replyTo: message.replyTo?.email,
        headers: message.headers,
      });
    },
  } as unknown as SendEmail;
  return { binding, sent };
}
