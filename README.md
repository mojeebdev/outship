<p align="center">
  <img src="docs/brand/outship-logo-512.png" alt="outship" width="96" height="96" />
</p>

<h1 align="center">outship</h1>

<p align="center">
  <b>proof you shipped.</b><br />
  github-verified releases, merged PRs, pushes and streaks, with receipts you can put onchain on base.
</p>

<p align="center">
  <a href="https://outship.dev">outship.dev</a> ·
  <a href="https://outship.dev/leaderboard">leaderboard</a> ·
  <a href="https://outship.dev/streaks">streaks</a> ·
  <a href="https://word.outship.dev">word</a> ·
  <a href="https://x.com/outshipdev">@outshipdev</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-0000ff" /></a>
  <img alt="Built on Cloudflare Workers" src="https://img.shields.io/badge/runs%20on-Cloudflare%20Workers-f38020" />
  <img alt="Attestations on Base" src="https://img.shields.io/badge/attestations-Base%20%2B%20EAS-0052ff" />
</p>

---

## What outship is

outship is a leaderboard and public record for people who build in public.

Install the outship GitHub App on the repos you choose. From then on, every
**release**, every **pull request merged into the default branch** and every
**push to the default branch** becomes a *ship*: it lands on your public
profile at `outship.dev/@you`, adds to your score, keeps your streak alive and
moves you up the leaderboard. Nothing is self-reported. GitHub tells outship,
and it does so for every ship, quiet weeks included.

Any public ship can also be **attested onchain** on [Base](https://base.org)
through the [Ethereum Attestation Service](https://attest.org). Once it's
attested, the receipt doesn't depend on outship: anyone can check it, and it
stays yours even if this site disappears.

outship complements [Talent Protocol's builder score](https://www.talentprotocol.com/)
rather than competing with it: one honest signal among several.

## Why I built it

"I ship" is the cheapest claim on the internet. Portfolios are curated after
the fact, bios are self-reported, and the work that actually happened this
week is buried in commit history nobody reads.

I wanted the opposite of a portfolio: a running record of what got shipped,
pulled straight from GitHub, in order. And I wanted it to hold up without
outship vouching for anyone, which is why the receipts can go onchain.

The rules are simple on purpose: **shipping counts, scripting doesn't, and if
you stop, your streak shows it.**

— **Mojeeb Titilayo**, creative product engineer in Lagos, building through
[BlindspotLab](https://blindspotlab.xyz).
[GitHub](https://github.com/mojeebdev) ·
[outship profile](https://outship.dev/@mojeebdev) ·
[about](https://outship.dev/about)

outship is built in public, and its own ships count: every release and push to
this repository shows up on that profile.

## Why now

- **Writing code got cheap.** With AI coding agents, anyone can generate a
  mountain of commits. What's still scarce is work that gets *merged* and
  *released*: code that made it to the people it was for. outship counts that,
  not lines or activity.
- **Claims got cheaper too.** When everyone's bio says "builder", a signal
  that can't be typed into a profile is worth more than ever.
- **Verifying it finally costs almost nothing.** An attestation on Base costs
  a fraction of a cent, so a public, permanent receipt for a single release is
  practical. A few years ago it wasn't.
- **Reputation is moving onchain.** Builder scores, grants and hiring are
  starting to read onchain records. outship gives them a source that started
  out as real GitHub work.

## Join in three steps

1. **Sign in with GitHub** at [outship.dev](https://outship.dev). You get a
   private dashboard and a public profile at `outship.dev/@your-handle`.
2. **Install the outship GitHub App** ([github.com/apps/outshipdev](https://github.com/apps/outshipdev))
   on the repos you want tracked. You choose which repos it can see, and can
   change that on GitHub at any time.
3. **Ship.** Your next release, merged PR or push to the default branch shows
   up on its own, usually within seconds.

Optional: connect a wallet on your profile to attest ships on Base, and join
the weekly ship recap.

## How scoring works

### What counts as a ship

| Ship | When it counts | Points |
| --- | --- | --- |
| **Release** | a release is published | **5** |
| **Merged PR** | a pull request is merged into the default branch | **2** |
| **Push** | a push lands on the default branch | **1** |

### Daily caps

Per builder, per UTC day, at most this many of each type score:

| Releases | Merged PRs | Pushes |
| --- | --- | --- |
| 2 | 5 | 1 |

That's at most 21 points a day from ships. Anything past the cap is still
recorded on your profile, it just doesn't add points, so spamming tags or
splitting work into dozens of PRs doesn't pay.

### Streaks

- Ship on a UTC day and your streak is alive for that day.
- Ship the next UTC day and it grows by one. More ships on the same day don't
  grow it further.
- Miss a whole UTC day and it ends. Streaks are checked daily at **00:05 UTC**.
- Your **longest streak** is kept for good and shown next to your current
  one on [`/streaks`](https://outship.dev/streaks). Reach 30 days and you're in
  the thirty-day club.

### Your score

```
score = points from ships (after daily caps) + current streak (counted up to 30)
```

A long streak helps, but it's capped at 30 bonus points, so it can't outweigh
actually shipping. When a streak ends, its bonus leaves your score with it.

### Fair-play rules

- **Private repos count, but stay private.** Ships from private repos add to
  your score and streak, but their repo name and tag never appear publicly
  (only you see them, on your own dashboard), and they can't be attested.
- **A merge and its push count once.** When a merged PR and a push carry the
  same commit, it's scored as the merge.
- **Bots don't score.** Releases and PRs authored by bots are skipped. A push
  made by a bot is credited to the commit's author only if they're already an
  outship builder.
- **Contributors get credit.** If you author a merged PR or a release in a
  repo where someone else installed the app, that ship is yours, even before
  you sign up.

## Where to see it

| Page | What's there |
| --- | --- |
| [`/leaderboard`](https://outship.dev/leaderboard) | everyone, ranked by score |
| [`/streaks`](https://outship.dev/streaks) | live streaks, longest first, with each builder's best |
| [`/builders`](https://outship.dev/builders) | every builder on outship, A to Z |
| `/@handle` | a builder's public profile: score, streaks and public ships, with a share card for X |
| [`/profile`](https://outship.dev/profile) | your private dashboard: every ship (private ones too), app status, attestations, recap switch |
| [`/changelog`](https://outship.dev/changelog) | what changed on outship |
| [`/manifesto`](https://outship.dev/manifesto) | what outship believes about shipping |

## Onchain attestations

Attesting is optional and done from your profile. outship signs the ship's
details from its own records, then your wallet sends the attestation on Base
and pays the gas, using outship's EAS schema (v2):

```
string repo, uint8 shipType, string identifier, string commitSha, uint64 timestamp, uint16 scoreSnapshot, string githubLogin, string shipId, uint64 deadline, bytes outshipSig
```

The schema's resolver contract ([`contracts/`](contracts/)) only accepts
attestations carrying outship's signature, so nobody can attest a ship that
isn't real. Before storing one, outship reads it back from Base and checks it.
(`shipType`: 0 = release, 1 = merged PR, 2 = push.) An attestation is public
and permanent and links your wallet to that ship. Attestations made with the
first schema, which had no resolver, show as "legacy · unverified". See
[docs/eas-schema.md](docs/eas-schema.md).

## The weekly ship recap

Every Monday: the most shipped builders of the week, fresh public releases and
the longest streaks, by email. Sign up from the form at the bottom of
[outship.dev](https://outship.dev) (you confirm by email first), or as a
builder, switch it on from your profile. Every issue has a one-click
unsubscribe.

## Word

[word.outship.dev](https://word.outship.dev) is a small sibling product: it
counts the words on any web page and compares the total with the earliest poem
by a named author. Same app, same Worker, its own hostname. See
[docs/word.md](docs/word.md).

## How it's built

- **App:** [Next.js](https://nextjs.org) 16 (App Router), TypeScript, Tailwind CSS
- **Runtime:** Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare),
  with a scheduled handler in `worker.js` for streaks and the recap
- **Data:** Cloudflare D1 through Prisma; SQL migrations in `migrations/`
- **GitHub:** a GitHub App (sign-in, installation and webhooks), verified by
  webhook signature
- **Onchain:** EAS on Base, through the builder's own wallet, with an
  outship-signed resolver contract (Foundry, in `contracts/`)
- **Email:** Cloudflare Email Service

```
src/app/            pages and API routes (webhooks: src/app/api/github/webhooks)
src/lib/score.ts    points, caps and streak rules: the source of truth
src/lib/            database, auth, GitHub App, attestations, email, Word
migrations/         D1 schema migrations, applied in order
worker.js           Worker entry: OpenNext plus the cron jobs
docs/               EAS schema, Word, brand assets
```

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars        # fill in your own GitHub App's values
npx wrangler d1 migrations apply DB --local
npm run preview                       # builds and runs on the real Workers runtime
```

`npm run dev` works for UI work, but `next dev` runs on Node, where the Prisma
D1 client can't load, so pages that read the database error there. Use
`npm run preview` for anything that touches data.

Checks to run before opening a PR:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:contracts   # needs Foundry, and: git submodule update --init --recursive contracts/lib
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: it
covers setup, the rules, and what needs an issue before a PR (anything that
changes scoring does).

Found a security issue? Please don't open a public issue. Email
**support@mail.outship.dev** instead.

## License

Copyright 2026 Mojeeb Titilayo and BlindspotLab Limited.

Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE).

The name "outship", "Word" and the outship logo are trademarks of
BlindspotLab Limited and aren't covered by the license: if you fork outship
to run your own version, give it a different name and logo.
