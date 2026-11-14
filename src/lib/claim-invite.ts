// The one-time claim invitation: a single comment on a merged PR, posted by
// the outship GitHub App, for someone who has ships on outship but has never
// signed in. GitHub has no DMs, and pulling addresses out of commits for
// outreach isn't acceptable, so this is the only channel, used once per person.
import { SITE_URL } from "@/lib/structured-data";
import { installationFetch, type AppCredentials } from "@/lib/github-app-auth";

const SITE_HOST = new URL(SITE_URL).host;

export function claimInviteComment(login: string, shipCount: number): string {
  const ships = `${shipCount} ship${shipCount === 1 ? "" : "s"}`;
  return (
    `🚢 @${login}, this merge counted as a ship on outship — the GitHub-verified shipping leaderboard. ` +
    `you have ${ships} waiting at ${SITE_HOST}/@${login}. claim your profile to keep your streak, or hide it. ` +
    `(one-time note · repo owners can turn these off at ${SITE_HOST}/profile)`
  );
}

/**
 * Posts the comment. Runs inside ctx.waitUntil, after the webhook has already
 * answered GitHub; any failure is logged and dropped. Until the App has the
 * "Pull requests: write" permission (and installers accept it), GitHub
 * answers 403 and this does nothing.
 */
export async function postClaimInvite(
  credentials: AppCredentials,
  { installationId, repo, prNumber, login, shipCount }: {
    installationId: number;
    repo: string;
    prNumber: number;
    login: string;
    shipCount: number;
  },
): Promise<void> {
  try {
    const response = await installationFetch(installationId, credentials, `/repos/${repo}/issues/${prNumber}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: claimInviteComment(login, shipCount) }),
    });
    if (!response) {
      console.warn("claim-invite: no installation token; skipped");
    } else if (!response.ok) {
      console.warn(`claim-invite: ${repo}#${prNumber} answered ${response.status}; skipped`);
    }
  } catch (error) {
    console.warn("claim-invite: failed", error);
  }
}
