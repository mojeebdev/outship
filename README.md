# outship

GitHub-verified commits, releases, and streaks — attested onchain on Base so the receipts are yours, not ours.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- Deployed to Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare)
- Cloudflare D1 (via Prisma), R2, and KV — to be wired in as the backend lands

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deploying

```bash
npm run preview   # build + preview locally against the Workers runtime
npm run deploy     # build + deploy to Cloudflare Workers
```
