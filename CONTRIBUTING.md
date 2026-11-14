# Contributing to outship

Thanks for wanting to help. outship is small and opinionated, so this page is
mostly about keeping it that way: fair scoring, honest data, and a fast,
quiet site.

## Before you start

- **Bugs:** open an issue with what you did, what you expected and what
  happened. A link to the page or the ship involved helps a lot.
- **Small fixes** (typos, copy, a broken link, an obvious bug): open a PR
  directly.
- **Anything bigger**, and anything that touches **scoring, streaks, caps,
  attestations or what data we store**: open an issue first and wait for a
  yes. These change what every builder's score means, so they're decided
  before they're coded.
- **Security issues:** don't open a public issue. Email
  **support@mail.outship.dev** with the details and we'll reply there.

## Setting up

You need Node 22+ and a GitHub account. For anything that touches sign-in or
webhooks, also a GitHub App of your own for testing (never outship's).

```bash
npm install
cp .dev.vars.example .dev.vars        # your own test App's values; never commit this file
npx wrangler d1 migrations apply DB --local
npm run preview                       # real Workers runtime, local D1
```

`npm run dev` is fine for UI-only work, but pages that read the database only
work under `npm run preview`.

This project uses **Next.js 16**, which differs from older versions. Before
writing Next.js code, check the docs bundled in `node_modules/next/dist/docs/`
(see [AGENTS.md](AGENTS.md)).

## The rules

### Code

1. **Keep PRs small and about one thing.** One fix or one feature per PR.
   Unrelated cleanups go in their own PR.
2. **All checks pass before review:**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   npm run test:contracts   # if you touched contracts/ (needs Foundry)
   ```
3. **Scoring lives in one place.** Points, daily caps and streak rules are in
   `src/lib/score.ts`. Don't hard-code a number from it anywhere else, in
   code or in copy.
4. **Add a test when you change logic** that has tests (scoring, Word), and
   for any bug fix where a test can catch the regression.
5. **No new dependencies without a reason** stated in the PR. Smaller is
   better: this runs on Cloudflare Workers.
6. **Never commit secrets.** No keys, tokens or `.dev.vars`. If one slips
   into a commit, say so in the PR right away so it can be rotated.

### Database

1. **Schema changes are new files in `migrations/`**, numbered after the last
   one (`0007_…sql`), with the matching change in `prisma/schema.prisma`.
   Never edit a migration that's already on `main`.
2. **Keep migrations additive** (new tables, new nullable or defaulted
   columns). Renames and drops need an issue first.
3. If your code reads a new column, say so in the PR: the migration has to
   reach production before the code does.

### Data and privacy

1. **Private repos stay private.** A private repo's name, tag or commit must
   never appear on a public page, card, API response, email or attestation.
2. **Store only what's needed** and update the [privacy page](src/app/privacy/page.tsx)
   in the same PR if what we store or who processes it changes.
3. **Anything onchain is permanent.** Changes to what an attestation
   contains need an issue and a new schema, never a quiet edit.

### Copy and design

- Site copy is lowercase and plain: short sentences, no hype, no
  exclamation marks.
- Match the existing tokens and components in `src/app/globals.css` and
  `src/components/` rather than adding new colours or one-off styles.
- Check your change at phone width (375px) as well as desktop.

### Commits and pull requests

- Write commit messages in the imperative: "Add streak badge", not
  "added streak badge".
- In the PR description, say **what** changed, **why**, and **how you
  tested it**. Screenshots for anything visual.
- Link the issue it closes (`Closes #12`).
- AI-assisted contributions are welcome. You're responsible for every line,
  so review it as if you wrote it, and run the checks.

## Your rights and ours

By opening a pull request you agree that your contribution is licensed under
the [Apache License 2.0](LICENSE), the same as the rest of the project (see
section 5 of the license), and that you have the right to submit it.

The names "outship" and "Word" and the outship logo are trademarks of
BlindspotLab Limited and aren't licensed for use in forks; see
[NOTICE](NOTICE).

## Be decent

Be kind and assume good faith, in issues, reviews and everywhere else.
Harassment, discrimination or personal attacks get you removed from the
project. Report problems to **mojeeb@mail.outship.dev**.

Thanks for shipping with us.
