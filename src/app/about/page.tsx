import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { IconGithub } from "@/components/icons";
import { MERGE_POINTS, PUSH_POINTS, RELEASE_POINTS, REVIEWED_MERGE_POINTS } from "@/lib/score";

export const metadata: Metadata = {
  title: "about — outship",
};

export default function AboutPage() {
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">about outship</h1>
        <p className="text-lg text-text-muted-1">
          outship is a leaderboard and brag platform for people who build in
          public. github-verified releases, merged PRs, pushes and streaks,
          with an onchain attestation layer on base so the receipts hold up
          without anyone having to take your word for it.
        </p>
        <p>
          it complements{" "}
          <a
            href="https://www.talentprotocol.com/"
            target="_blank"
            rel="noreferrer"
            className="text-base-blue hover:underline"
          >
            talent protocol&apos;s builder score
          </a>{" "}
          rather than competing with it — one signal among several, not a
          rebuild of the whole thing.
        </p>

        <h2 className="mt-6 text-xl font-medium">why i built it</h2>
        <p>
          &ldquo;i ship&rdquo; is the cheapest claim on the internet. portfolios
          are curated after the fact, bios are self-reported, and the work
          that actually happened this week is buried in commit history nobody
          reads.
        </p>
        <p>
          i wanted the opposite of a portfolio: a running record of what got
          shipped, pulled straight from github, in order, quiet weeks
          included. and i wanted it to hold up without outship vouching for
          anyone, which is why the receipts can go onchain. once a ship is
          attested on base, it&apos;s yours, not ours.
        </p>
        <p>
          the rules are simple on purpose: shipping counts, scripting
          doesn&apos;t, and if you stop, your streak shows it. a release with
          notes is worth {RELEASE_POINTS} points, a merged pull request{" "}
          {MERGE_POINTS}, or {REVIEWED_MERGE_POINTS} when someone else merged
          it, and a push {PUSH_POINTS}, with daily caps; your github history
          shows on your profile but never counts. the{" "}
          <Link href="/faq#scoring" className="text-base-blue hover:underline">
            faq
          </Link>{" "}
          has the details.
        </p>

        <h2 className="mt-6 text-xl font-medium">the builder behind it</h2>
        <p>
          i&apos;m mojeeb titilayo, a creative product engineer in lagos. i
          make products end to end, from the interface to the code and the
          infrastructure underneath, through{" "}
          <a
            href="https://blindspotlab.xyz"
            target="_blank"
            rel="noreferrer"
            className="text-base-blue hover:underline"
          >
            BlindspotLab
          </a>
          , the studio behind outship and{" "}
          <a
            href="https://word.outship.dev"
            className="text-base-blue hover:underline"
          >
            word
          </a>
          .
        </p>
        <p>
          outship is built in public, and its own ships count: every release
          and push to this site shows up on{" "}
          <Link href="/@mojeebdev" className="text-base-blue hover:underline">
            my profile
          </Link>
          .
        </p>
        <a
          href="https://github.com/mojeebdev"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-cream"
        >
          <IconGithub className="h-4 w-4" aria-hidden="true" />
          mojeebdev on github
        </a>
      </article>
    </SiteShell>
  );
}
