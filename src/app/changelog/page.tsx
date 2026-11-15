import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { IconShip } from "@/components/icons";
import {
  BARE_RELEASE_POINTS,
  MAX_DAILY_POINTS,
  MERGE_POINTS,
  PUSH_POINTS,
  RELEASE_POINTS,
  REVIEWED_MERGE_POINTS,
  STREAK_CAP,
  STREAK_POINTS_PER_DAY,
} from "@/lib/score";
import { TIERS } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "changelog — outship",
};

const entries = [
  {
    date: "nov 2026",
    title: "your ships count from the day you join",
    description:
      "everything you ship after installing the outship app scores the moment github reports it: releases, merged PRs and pushes to the default branch. work from before you joined isn't imported, so everyone starts from the same line.",
  },
  {
    date: "nov 2026",
    title: "outship in numbers",
    description:
      "outship.dev/stats shows the public numbers, live: verified ships, builders, repos, onchain receipts, the last 30 days against the 30 before, ships per week for a year and the languages shipped. page views are now counted with cloudflare's cookieless web analytics; the privacy policy says exactly what that records.",
  },
  {
    date: "nov 2026",
    title: "the outship API",
    description:
      "a public API for verified shipping records: a builder's score, tier, streaks and ranks, their public ships with onchain receipts, a one-call check of whether someone shipped something, and the leaderboards. free to try without a key, with keys for higher limits. docs at outship.dev/developers.",
  },
  {
    date: "nov 2026",
    title: "v0.1.5: bigger points, tiers, and a logo in your inbox",
    description: `points are scaled up for launch, with the same balance between kinds of ship: a release with notes ${RELEASE_POINTS} (a bare tag ${BARE_RELEASE_POINTS}), a merged PR ${MERGE_POINTS} or ${REVIEWED_MERGE_POINTS} when someone else merged it, a push ${PUSH_POINTS}, and ${STREAK_POINTS_PER_DAY} points per streak day for up to ${STREAK_CAP} days. a day can earn up to ${MAX_DAILY_POINTS}. every score was recalculated, so nobody's place changed because of the switch. your all-time score now puts you in a tier, from ${TIERS[0].name} to ${TIERS[TIERS.length - 1].name}, shown on your profile, the all-time board and your README badge. the home page opens on a new hero: the outship tower, drawn as an engraving, with a navbar of floating pills. and outship's emails carry the logo.`,
  },
  {
    date: "nov 2026",
    title: "richer profiles, a live home page and a README badge",
    description:
      "profiles now show your github name, bio, location and links, your top languages, a breakdown of releases, merged PRs and pushes, and your rank this week and all time. the home page shows the latest public ships as they land and how many builders shipped today. and there's a badge for your github README at outship.dev/@you/badge.svg; copy it from your profile.",
  },
  {
    date: "nov 2026",
    title: "leaderboards a newcomer can win",
    description:
      "the leaderboard now opens on this week, from monday 00:00 UTC, with tabs for this month and all time. filter by language, page past the top 50, and see who's rising: the biggest gains on last week. ties go to whoever got there first.",
  },
  {
    date: "nov 2026",
    title: "scoring that rewards real work",
    // Frozen at the numbers it announced: later releases changed the scale.
    description:
      "a merged PR is now worth 3 points instead of 2 when someone other than its author merged it, or when it came from outside the repo: work a second person looked at is harder to fake. a release is worth 5 only with notes or a file attached; a bare tag is worth 2. the most a day can earn is now 26, and when a day has more ships than the cap, the ones worth most count. streaks are now worked out from your ships themselves, so a late or repeated webhook can't break one. every builder was rescored under the new rules; releases from before this change keep full points, since there's no record of what they contained.",
  },
  {
    date: "nov 2026",
    title: "your last year on github, on your profile",
    description:
      "signing in now imports your github contribution graph and totals for the last year, so a new profile doesn't start empty. it's shown as a heatmap labelled github history.",
  },
  {
    date: "nov 2026",
    title: "unclaimed profiles, and a way to hide yours",
    description:
      "people who ship in a repo with the outship app but haven't signed in now have clearly labelled unclaimed profiles: public activity only, unranked and not indexed. the first merged PR may get one comment from the app inviting them to claim or hide it, once per person, and installers can switch that off. any builder can now hide their profile from public pages, and profiles show your github name, bio, location and links.",
  },
  {
    date: "nov 2026",
    title: "attestations outship can stand behind",
    description:
      "attesting a ship now works in two steps: outship signs the ship's details from its own records, then your wallet sends the attestation and pays the fee. the new schema's resolver contract on base refuses anything outship didn't sign, and outship reads each attestation back from base before showing it. receipts made with the first schema, which anyone could write to, are marked legacy · unverified.",
  },
  {
    date: "nov 2026",
    title: "the weekly ship recap, and a welcome email",
    description:
      "every monday the recap brings the week's most shipped builders, fresh releases and longest streaks to your inbox. signups confirm by email first, builders can switch it on from their profile, and every issue has a one-click unsubscribe. new builders also get a short welcome with how points work.",
  },
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
