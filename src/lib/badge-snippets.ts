// What /profile hands a builder to put their README badge in place: the
// markdown and HTML snippets, and a prompt for a coding agent (Claude,
// Cursor, Copilot…) that does it for them. Pure strings, tested directly.
import { BADGE_HEIGHT, BADGE_WIDTH } from "./badge";
import { SITE_URL } from "./structured-data";

export function badgeSnippets(login: string) {
  const profile = `${SITE_URL}/@${login}`;
  const badge = `${profile}/badge.svg`;
  return {
    profile,
    badge,
    markdown: `[![${login} on outship](${badge})](${profile})`,
    html: `<a href="${profile}"><img src="${badge}" alt="${login} on outship" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"></a>`,
  };
}

/**
 * A prompt a builder pastes into their coding agent. It names the exact
 * snippet, where it goes and what not to touch, so the agent adds one line
 * instead of rewriting the README.
 */
export function badgeAgentPrompt(login: string): string {
  const { markdown, profile } = badgeSnippets(login);
  return [
    "Add my outship badge to the README.md of this repository.",
    "",
    `(If you can work in my GitHub profile repository, github.com/${login}/${login}, put it in that README instead: it shows on my GitHub profile page.)`,
    "",
    "1. Add this line exactly as written, near the top: under the main heading or intro, or on the same line as any existing badges.",
    "",
    markdown,
    "",
    "2. If README.md doesn't exist, create it with a heading and this line.",
    "3. Don't change anything else in the file.",
    '4. Show me the change, then commit it with the message "Add outship badge".',
    "",
    `The badge is an image of my outship score, streak and rank, updated hourly. It links to ${profile}.`,
  ].join("\n");
}
