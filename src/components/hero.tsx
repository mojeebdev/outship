import Link from "next/link";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { IconNode, IconSeal, IconShip, IconStreak } from "@/components/icons";
import { ClimbScene } from "@/components/climb-scene";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-10 text-center sm:pt-24">
      <IconNode className="pointer-events-none absolute left-8 top-16 hidden h-10 w-10 text-void/10 sm:block" />
      <IconShip className="pointer-events-none absolute right-10 top-24 hidden h-8 w-8 text-base-blue/15 sm:block" />
      <IconStreak className="pointer-events-none absolute bottom-16 left-16 hidden h-9 w-9 text-void/10 sm:block" />
      <IconSeal className="pointer-events-none absolute bottom-10 right-20 hidden h-8 w-8 text-base-blue/15 sm:block" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 sm:gap-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-tint px-4 py-1.5 text-xs font-medium text-base-blue">
          <IconSeal className="h-3.5 w-3.5" />
          verified onchain · base
        </span>

        <h1 className="text-3xl font-medium leading-tight sm:text-6xl">
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
          <ConnectGithubButton />
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center gap-2.5 rounded-md border border-void px-6 py-3 text-sm font-medium transition hover:bg-void hover:text-white"
          >
            <IconStreak className="h-5 w-5 shrink-0" aria-hidden="true" />
            see the leaderboard
          </Link>
        </div>
      </div>

      {/* The climb: every verified ship moves you up the tiers. Links to the
          all-time board, where the tiers are shown. */}
      <Link
        href="/leaderboard/all"
        aria-label="the climb from deckhand to admiral: see the all-time board"
        className="relative -mx-6 mt-12 block sm:mt-16"
      >
        <ClimbScene />
      </Link>
    </section>
  );
}
