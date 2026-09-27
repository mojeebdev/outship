# outship

GitHub-verified commits, releases, and streaks — attested onchain on Base so the receipts are yours, not ours.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- Deployed to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare)
- Cloudflare D1 (via Prisma), R2, and KV — to be wired in as the backend lands

## Products

- **outship** — outship.dev, the leaderboard and attestation platform above.
- **Word** — [word.outship.dev](https://word.outship.dev), a word counter for
  web pages. Same app, same Worker, served from its own hostname. See
  [docs/word.md](docs/word.md) for its routing, counting rules, SSRF controls
  and Cloudflare setup.

## Getting started

```bash
npm install
npx wrangler d1 migrations apply outship-db --local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app, and
[http://localhost:3000/word](http://localhost:3000/word) for Word.

Note that `next dev` runs on Node, where the Prisma D1 client can't load its
WASM engine, so pages that read the database error locally. Use `npm run
preview` to exercise them against the real Workers runtime.

## Tests

```bash
npm run test:word         # Word's counting, URL safety and comparison tests
npm run verify:benchmark  # re-derive Word's historical benchmark from Oxford
```

## Deploying

```bash
npm run preview   # build + preview locally against the Workers runtime
npm run deploy     # build + deploy to Cloudflare Workers
```
