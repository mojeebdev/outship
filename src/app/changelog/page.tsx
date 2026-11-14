import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { IconShip } from "@/components/icons";

export const metadata: Metadata = {
  title: "changelog — outship",
};

const entries = [
  {
    date: "nov 2026",
    title: "pushes count, with fair caps and streaks that end",
    description:
      "a push to a repo's default branch now counts as a ship, once a day. each day at most 2 releases, 5 merged PRs and 1 push score, so scripting doesn't pay. streaks now end at 00:05 UTC after a missed day. ships from private repos count toward your score but stay hidden on public pages and can't be attested.",
  },
  {
    date: "nov 2026",
    title: "the outship github app",
    description:
      "after signing in, your profile asks you to install the outship github app on the repos you want tracked. that's what turns releases, merged PRs and pushes into ships, and you choose which repos it sees.",
  },
  {
    date: "nov 2026",
    title: "onchain attestations are live on base",
    description:
      "the ship attestation schema is registered on base mainnet. attest any public ship from your profile and the receipt lives onchain, checkable without asking outship.",
  },
  {
    date: "nov 2026",
    title: "a sharper site",
    description:
      "a navigation that works on mobile, github sign-in buttons that look the part, and icons on every action.",
  },
  {
    date: "sep 2026",
    title: "word, a word counter for any web page",
    description:
      "word.outship.dev counts the words on any page and compares the total with enheduanna's exaltation of inana, the earliest poem by a named author.",
  },
  {
    date: "sep 2026",
    title: "profiles, the leaderboard and streaks",
    description:
      "sign in with github for a private dashboard and a public profile at /@handle, ranked on the leaderboard, the builder index and the streaks board, with share cards for x.",
  },
  {
    date: "sep 2026",
    title: "landing page is live",
    description:
      "the site is up: hero, featured ships, the manifesto and the weekly ship recap signup.",
  },
];

export default function ChangelogPage() {
  return (
    <SiteShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">changelog</h1>
        <ol className="flex flex-col gap-8">
          {entries.map(({ date, title, description }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-tint">
                <IconShip className="h-4 w-4 text-base-blue" />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted-2">{date}</span>
                <h2 className="font-medium">{title}</h2>
                <p className="text-sm text-text-muted-1">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </SiteShell>
  );
}
