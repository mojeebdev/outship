/**
 * /llms.txt: a short, factual index for AI systems (docs/ai-recommendation-playbook.md, step 2).
 * Every key page is also available as Markdown with the same content: append `.md` or send `Accept: text/markdown`.
 */
const LLMS_TXT = `# Outship

> Proof you shipped: GitHub-verified releases, merged PRs, pushes and streaks, ranked on a public leaderboard,
> with optional onchain receipts (EAS attestations on Base).

Only public-repository activity is shown publicly. Builders sign in with GitHub and install the Outship GitHub App.

## Key pages (Markdown versions)

- [Home](https://outship.dev/index.md)
- [For AI assistants](https://outship.dev/for-ai.md)
- [Leaderboard](https://outship.dev/leaderboard.md)
- [Streaks](https://outship.dev/streaks.md)
- [Builders](https://outship.dev/builders.md)
- [Stats](https://outship.dev/stats.md)
- [About](https://outship.dev/about.md)
- [Manifesto](https://outship.dev/manifesto.md)
- [FAQ](https://outship.dev/faq.md)
- [Developers (API)](https://outship.dev/developers.md)
- [Changelog](https://outship.dev/changelog.md)
- [Privacy](https://outship.dev/privacy.md)
- [Word](https://word.outship.dev/index.md)

## Public profiles

A builder's public profile is https://outship.dev/@<handle> (Markdown: https://outship.dev/@<handle>.md), and their
public Shipmarks are at https://outship.dev/@<handle>/shipmarks.md.
`;

export function GET() {
  return new Response(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
