import Link from "next/link";
import { IconNode, IconSeal, IconShip, IconStreak } from "@/components/icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 py-24 text-center">
      <IconNode className="pointer-events-none absolute left-8 top-16 hidden h-10 w-10 text-void/10 sm:block" />
      <IconShip className="pointer-events-none absolute right-10 top-24 hidden h-8 w-8 text-base-blue/15 sm:block" />
      <IconStreak className="pointer-events-none absolute bottom-16 left-16 hidden h-9 w-9 text-void/10 sm:block" />
      <IconSeal className="pointer-events-none absolute bottom-10 right-20 hidden h-8 w-8 text-base-blue/15 sm:block" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-tint px-4 py-1.5 text-xs font-medium text-base-blue">
          <IconSeal className="h-3.5 w-3.5" />
          verified onchain · base
        </span>

        <h1 className="text-4xl font-medium leading-tight sm:text-6xl">
          everyone says they ship.
          <br />
          now you can <span className="text-base-blue">prove it.</span>
        </h1>

        <p className="max-w-xl text-base text-text-muted-1 sm:text-lg">
          github-verified commits, releases, and streaks — attested onchain
          so the receipts are yours, not ours.
        </p>

        <p className="text-sm text-text-muted-2">
          + shipping&nbsp;&nbsp;+ ranking&nbsp;&nbsp;+ bragging
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <a
            href="#"
            className="rounded-md bg-base-blue px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            connect github →
          </a>
          <Link
            href="/leaderboard"
            className="rounded-md border border-void px-6 py-3 text-sm font-medium transition hover:bg-void hover:text-white"
          >
            see the leaderboard
          </Link>
        </div>
      </div>
    </section>
  );
}
