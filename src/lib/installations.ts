// Keeps the Installation table in step with GitHub. installation events carry
// the account; every other delivery carries only payload.installation.id, and
// its repository belongs to that same account, so the owner fills it in. That
// way a row exists for every current install, including ones made before
// outship listened for installation events.
import type { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

type Account = { login: string; type?: string; id?: number };
type Payload = {
  action?: string;
  installation?: { id?: number; account?: Account | null };
  repository?: { owner?: Account };
  sender?: { id?: number };
};

export function installationFromPayload(payload: Payload): { id: number; account: Account } | null {
  const id = payload.installation?.id;
  if (typeof id !== "number") return null;
  const account = payload.installation?.account ?? payload.repository?.owner;
  if (!account?.login) return null;
  return { id, account };
}

export async function syncInstallation(db: Db, event: string, payload: Payload): Promise<void> {
  const found = installationFromPayload(payload);
  if (!found) return;
  const { id, account } = found;
  const accountType = account.type ?? "User";
  const now = new Date();

  // Lifecycle changes only come from the installation event itself.
  const lifecycle =
    event !== "installation"
      ? {}
      : payload.action === "deleted"
        ? { deletedAt: now }
        : payload.action === "suspend"
          ? { suspendedAt: now }
          : payload.action === "unsuspend"
            ? { suspendedAt: null }
            : payload.action === "created"
              ? { deletedAt: null, suspendedAt: null }
              : {};

  await db.installation.upsert({
    where: { id },
    update: { accountLogin: account.login, accountType, ...lifecycle },
    create: { id, accountLogin: account.login, accountType, ...lifecycle },
  });

  if (event === "installation") await linkBuilders(db, payload, id, account);
}

/**
 * Keeps Builder.installationId in step with installs. Sign-in reads it from
 * GitHub, but the usual order is sign in, then install: without this the
 * builder kept looking uninstalled (banner, pop-up, reminder email, admin
 * count) until their next sign-in. Builders who don't exist yet are linked
 * when they first sign in.
 */
async function linkBuilders(db: Db, payload: Payload, id: number, account: Account): Promise<void> {
  const action = payload.action;
  if (action === "deleted") {
    await db.builder.updateMany({ where: { installationId: id }, data: { installationId: null } });
    return;
  }
  if (action !== "created" && action !== "unsuspend" && action !== "new_permissions_accepted") return;
  // A personal install belongs to that account's builder.
  if (account.type !== "Organization" && typeof account.id === "number") {
    await db.builder.updateMany({ where: { githubId: account.id }, data: { installationId: id } });
  }
  // Whoever installed it (say, on their org) counts as installed too, unless
  // they already have an install of their own; sign-in picks the same way.
  const sender = payload.sender?.id;
  if (typeof sender === "number" && sender !== account.id) {
    await db.builder.updateMany({ where: { githubId: sender, installationId: null }, data: { installationId: id } });
  }
}
