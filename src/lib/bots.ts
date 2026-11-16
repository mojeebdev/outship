// Bots and AI agents that commit and open PRs as ordinary GitHub *user*
// accounts. GitHub marks real bot apps with type "Bot" (live webhooks) or
// __typename "Bot" (GraphQL), and both paths skip those already; these slip
// through because, on a commit or PR, they look like people. The history
// import credited them before (@claude, @v0, @netlify-bot on the board), and
// none of them is a builder. Names are matched case-insensitively.
const BOT_LOGINS = new Set([
  "claude",
  "v0",
  "copilot",
  "codex",
  "chatgpt-codex-connector",
  "cursor",
  "cursoragent",
  "devin-ai-integration",
  "google-labs-jules",
  "jules",
  "gemini-code-assist",
  "openhands-agent",
  "sweep-ai",
  "coderabbitai",
  "sourcery-ai",
  "lovable-dev",
  "replit",
  "github-actions",
  "dependabot",
  "dependabot-preview",
  "renovate",
  "greenkeeper",
  "imgbot",
  "allcontributors",
  "codecov",
  "mergify",
  "kodiakhq",
  "pre-commit-ci",
  "vercel",
  "netlify",
]);

// "[bot]" apps, and the "-bot"/"_bot" naming convention (netlify-bot,
// snyk-bot, semantic-release-bot).
const BOT_PATTERN = /\[bot\]$|[-_]bot$/i;

export function isBotLogin(login: string): boolean {
  return BOT_PATTERN.test(login) || BOT_LOGINS.has(login.toLowerCase());
}
