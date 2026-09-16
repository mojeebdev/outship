import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

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
          public. github-verified commits, releases, and streaks, with an
          onchain attestation layer on base so the receipts hold up without
          anyone having to take your word for it.
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

        <p>
          outship is built by{" "}
          <a
            href="https://blindspotlab.xyz"
            target="_blank"
            rel="noreferrer"
            className="text-base-blue hover:underline"
          >
            BlindspotLab
          </a>
          , a product studio based in Lagos.
        </p>
      </article>
    </SiteShell>
  );
}
