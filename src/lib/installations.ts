// Keeps the Installation table in step with GitHub. installation events carry
// the account; every other delivery carries only payload.installation.id, and
// its repository belongs to that same account, so the owner fills it in. That
// way a row exists for every current install, including ones made before
// outship listened for installation events.
import type { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

type Account = { login: string; type?: string };
type Payload = {
  action?: string;
  installation?: { id?: number; account?: Account | null };
  repository?: { owner?: Account };
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
}
