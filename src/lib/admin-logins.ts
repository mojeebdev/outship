// Who may open /admin: GitHub logins from the ADMIN_GITHUB_LOGINS Worker
// variable (comma-separated), or outship's owner when it isn't set. Pure, so
// it's tested on its own (src/lib/admin.ts does the request side).

const DEFAULT_ADMINS = ["mojeebdev"];

export function adminLogins(configured: string | undefined): string[] {
  const list = (configured ?? "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ADMINS;
}

export function isAdminLogin(login: string, configured: string | undefined): boolean {
  return adminLogins(configured).includes(login.toLowerCase());
}

