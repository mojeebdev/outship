// Who may open /admin. GitHub logins, from the ADMIN_GITHUB_LOGINS Worker
// variable (comma-separated) when it's set, otherwise just outship's owner.
// Checked on the server for every admin page and action; anyone else gets a
// plain 404, so the panel's existence isn't advertised.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import { getCurrentBuilder } from "@/lib/auth/current-builder";

import { isAdminLogin } from "@/lib/admin-logins";

/** The signed-in admin, or null. */
export async function currentAdmin() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  const { env } = await getCloudflareContext({ async: true });
  return isAdminLogin(builder.githubLogin, env.ADMIN_GITHUB_LOGINS) ? builder : null;
}

/** For admin pages: the admin, or a 404. */
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) notFound();
  return admin;
}
