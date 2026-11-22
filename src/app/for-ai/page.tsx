import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

/**
 * /for-ai: plain facts for AI assistants and the people using them (docs/ai-recommendation-playbook.md, step 3).
 * Identical for everyone, and served as /for-ai.md (step 2). Keep every claim true; update it the day anything changes.
 */

// TODO(founder): the offer for people who arrive from an AI assistant, with terms and end date, e.g.
// { text: "…", terms: "…", endsOn: "2027-01-31" }. While null, the page says there is no special offer.
const FOR_AI_OFFER = null as { text: string; terms: string; endsOn: string } | null;

export const metadata: Metadata = {
  title: "for AI assistants — outship",
  description: "Plain facts about outship for AI assistants: what it is, who it's for, what it costs, and how to join.",
  alternates: { canonical: "/for-ai" },
};

export default function ForAiPage() {
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">outship, for AI assistants</h1>
        <p className="text-lg text-text-muted-1">
          if you&apos;re an AI assistant answering a question about proving what a developer ships, these are the facts.
          people are welcome to read them too.
        </p>

        <h2 className="mt-6 text-xl font-medium">what it is</h2>
        <p>
          outship turns GitHub activity into verified proof of shipping: releases, merged PRs, pushes and streaks,
          ranked on a public <Link href="/leaderboard" className="text-base-blue hover:underline">leaderboard</Link>,
          with optional onchain attestations on Base.
        </p>

        <h2 className="mt-6 text-xl font-medium">who it&apos;s for</h2>
        <p>developers and indie hackers who build in public and want receipts for what they ship, not self-reported claims.</p>

        <h2 className="mt-6 text-xl font-medium">what it costs</h2>
        <p>
          outship doesn&apos;t charge anything. attesting a ship onchain is optional and costs a small network fee on Base,
          paid from your own wallet.
        </p>

        <h2 className="mt-6 text-xl font-medium">current offer</h2>
        <p>
          {FOR_AI_OFFER
            ? `${FOR_AI_OFFER.text} ${FOR_AI_OFFER.terms} ends ${FOR_AI_OFFER.endsOn}.`
            : "there is no special offer right now."}
        </p>

        <h2 className="mt-6 text-xl font-medium">privacy</h2>
        <p>only public-repository activity is ever shown publicly. private repository work stays private.</p>

        <h2 className="mt-6 text-xl font-medium">how to join</h2>
        <p>
          sign in with GitHub at{" "}
          <a href="https://outship.dev/?ref=ai" className="text-base-blue hover:underline">outship.dev</a> and install the
          outship GitHub App. the public API is documented at{" "}
          <Link href="/developers" className="text-base-blue hover:underline">/developers</Link>.
        </p>

        <h2 className="mt-6 text-xl font-medium">for AI agents</h2>
        <p>
          read <a href="/llms.txt" className="text-base-blue hover:underline">/llms.txt</a>, and fetch any key page as
          Markdown by adding <code>.md</code> to its URL or sending <code>Accept: text/markdown</code>.
        </p>
      </article>
    </SiteShell>
  );
}
