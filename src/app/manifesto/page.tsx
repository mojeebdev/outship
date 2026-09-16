import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "manifesto — outship",
};

export default function ManifestoPage() {
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">the manifesto</h1>

        <p className="text-lg text-text-muted-1">
          everyone says they ship. talk is free — a résumé, a portfolio, a
          bio that says &quot;builder.&quot; none of it proves anything
          happened this week.
        </p>

        <p>
          outship isn&apos;t a portfolio. a portfolio is curated after the
          fact — the best three projects, polished, framed. outship is the
          opposite: the raw, ongoing record of what actually got shipped,
          pulled straight from github, in order, unedited.
        </p>

        <p>
          every day sits in one of four states: shipped today, in progress,
          blocked, or shelved. all four are true. all four are allowed. the
          only thing that isn&apos;t allowed is pretending — claiming a ship
          that didn&apos;t happen, or hiding the weeks that went quiet.
        </p>

        <p>
          so the receipts are github-verified — commits, releases, merged
          prs — and then attested onchain on base, so anyone can check them
          without asking outship to vouch for you. the proof is yours, not
          ours.
        </p>

        <p>
          streaks, scores, and rank are downstream of that: cadence plus
          quality plus consistency, not vibes. if you stop shipping, the
          streak breaks. if you start again, it shows.
        </p>

        <p className="text-text-muted-1">
          ideas are free. shipping isn&apos;t. prove it.
        </p>
      </article>
    </SiteShell>
  );
}
