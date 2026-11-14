// The outship GitHub App: github.com/apps/outshipdev
export const GITHUB_APP_SLUG = "outshipdev";

// For an account that has already installed the App, GitHub serves this same
// URL as the "configure" screen, so it doubles as the manage-repos link.
export const GITHUB_APP_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;

type Installation = { id: number; account: { id: number } | null };

/**
 * Which installation of the App this user can see, asked of GitHub with the
 * user's own token — so it can't be spoofed the way an installation_id in a
 * redirect URL can. Prefers the install on the user's own account.
 *
 * Returns null when they have none, and undefined when GitHub couldn't be
 * asked, so callers can leave a previously known value alone.
 */
export async function fetchUserInstallationId(
  accessToken: string,
  githubUserId: number,
): Promise<number | null | undefined> {
  const response = await fetch("https://api.github.com/user/installations", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "outship",
    },
  });
  if (!response.ok) return undefined;

  const data = (await response.json()) as { installations?: Installation[] };
  const installations = data.installations ?? [];
  const own = installations.find((installation) => installation.account?.id === githubUserId);
  return (own ?? installations[0])?.id ?? null;
}
