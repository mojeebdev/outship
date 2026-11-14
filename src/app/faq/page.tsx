import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import { DAILY_CAPS, SHIP_WEIGHTS, STREAK_CAP } from "@/lib/score";
import { SITE_ID, SITE_URL, jsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "faq — outship",
  description:
    "how outship works: what counts as a ship, how points and streaks are scored, private repos, onchain attestations and the weekly recap.",
};

const MAX_DAILY_POINTS =
  SHIP_WEIGHTS.RELEASE * DAILY_CAPS.RELEASE +
  SHIP_WEIGHTS.MERGE * DAILY_CAPS.MERGE +
  SHIP_WEIGHTS.PUSH * DAILY_CAPS.PUSH;

const SUPPORT_EMAIL = "support@mail.outship.dev";

type Faq = {
  question: string;
  /** Plain text, for search engines' FAQ results. */
  text: string;
  /** What's shown on the page; defaults to `text`. */
  answer?: React.ReactNode;
};

const link = "text-base-blue hover:underline";

const groups: { heading: string; faqs: Faq[] }[] = [
  {
    heading: "getting started",
    faqs: [
      {
        question: "what is outship?",
        text: "a public record of what you actually ship on github: releases, merged pull requests and pushes, scored, ranked on a leaderboard and kept as a streak. any public ship can also be attested onchain on base, so the receipt doesn't depend on outship.",
      },
      {
        question: "how do i join?",
        text: "sign in with github, then install the outship github app on the repos you want tracked. your next release, merged PR or push to the default branch shows up on its own.",
        answer: (
          <>
            sign in with github, then{" "}
            <a href={GITHUB_APP_INSTALL_URL} className={link}>
              install the outship github app
            </a>{" "}
            on the repos you want tracked. your next release, merged PR or push
            to the default branch shows up on its own, usually within seconds.
          </>
        ),
      },
      {
        question: "does it cost anything?",
        text: "outship doesn't charge anything. attesting a ship onchain is optional and costs a small network fee on base, usually a fraction of a cent, paid from your own wallet.",
      },
      {
        question: "can i choose which repos it sees?",
        text: "yes. you pick the repos when you install the github app and can change them on github at any time. outship never sees a repo you haven't given the app.",
        answer: (
          <>
            yes. you pick the repos when you install the github app, and can
            change them on github at any time: &ldquo;manage repos&rdquo; on{" "}
            <Link href="/profile" className={link}>
              your profile
            </Link>{" "}
            takes you there. outship never sees a repo you haven&apos;t given
            the app.
          </>
        ),
      },
    ],
  },
  {
    heading: "scoring",
    faqs: [
      {
        question: "what counts as a ship?",
        text: `a published release (${SHIP_WEIGHTS.RELEASE} points), a pull request merged into the default branch (${SHIP_WEIGHTS.MERGE} points), and a push to the default branch (${SHIP_WEIGHTS.PUSH} point). work on other branches doesn't count until it lands.`,
      },
      {
        question: "is there a daily limit?",
        text: `yes. per builder, per UTC day, at most ${DAILY_CAPS.RELEASE} releases, ${DAILY_CAPS.MERGE} merged PRs and ${DAILY_CAPS.PUSH} push score, so at most ${MAX_DAILY_POINTS} points a day from ships. anything past the cap still shows on your profile, it just doesn't add points. splitting work into dozens of PRs or tags doesn't pay.`,
      },
      {
        question: "how do streaks work?",
        text: "ship on consecutive UTC days and your streak grows by one each day. more ships on the same day don't grow it further. miss a whole UTC day and it ends: streaks are checked every day at 00:05 UTC. your longest streak is kept and shown on the streaks board.",
      },
      {
        question: "how is my score worked out?",
        text: `points from ships, after the daily caps, plus your current streak counted up to ${STREAK_CAP}. a long streak helps, but it can't outweigh actually shipping, and when a streak ends its bonus leaves your score with it.`,
      },
      {
        question: "does a merged PR also count as a push?",
        text: "no. merging a PR pushes to the default branch too, but it's scored once, as the merge.",
      },
      {
        question: "do commits from bots or AI agents count?",
        text: "releases and pull requests authored by bots don't score. a push made by a bot, such as an AI agent's github app, is credited to the commit's author, but only if they're already an outship builder.",
      },
      {
        question: "why didn't my ship show up?",
        text: "check that the outship app is installed on that repo, that the PR was merged into the default branch or the push landed on it, that the release is published rather than a draft, and that you haven't hit the daily cap for that kind of ship. if it still isn't there, email us with the link.",
        answer: (
          <>
            check that the outship app is installed on that repo, that the PR
            was merged into the default branch (or the push landed on it), that
            the release is published rather than a draft, and that you
            haven&apos;t hit the daily cap for that kind of ship. still missing?
            email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
              {SUPPORT_EMAIL}
            </a>{" "}
            with the link.
          </>
        ),
      },
    ],
  },
  {
    heading: "privacy",
    faqs: [
      {
        question: "do private repos count?",
        text: "yes. ships from private repos add to your score and streak, but their repo name and tag never appear on public pages, share cards or the recap. only you see them, on your own profile, and they can't be attested onchain.",
      },
      {
        question: "what does outship store about me?",
        text: "your github id, username and primary verified email, your app installation, and the ships themselves. github's sign-in token is used once and discarded. the privacy policy has the full list.",
        answer: (
          <>
            your github id, username and primary verified email, your app
            installation, and the ships themselves. github&apos;s sign-in token
            is used once and discarded. the{" "}
            <Link href="/privacy" className={link}>
              privacy policy
            </Link>{" "}
            has the full list.
          </>
        ),
      },
      {
        question: "can i delete my data?",
        text: "yes, email us and we'll delete your account, ships and email address. attestations you've made onchain are the exception: nobody, including us, can delete anything once it's on the blockchain.",
        answer: (
          <>
            yes: email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
              {SUPPORT_EMAIL}
            </a>{" "}
            and we&apos;ll delete your account, ships and email address.
            attestations you&apos;ve made onchain are the exception: nobody,
            including us, can delete anything once it&apos;s on the blockchain.
          </>
        ),
      },
    ],
  },
  {
    heading: "onchain",
    faqs: [
      {
        question: "what does “attest onchain” do?",
        text: "it writes a receipt for one ship to base using the ethereum attestation service: the repo, ship type, tag or PR number, commit, time and your score then. your wallet signs it, so the receipt is yours and anyone can check it without asking outship.",
      },
      {
        question: "do i have to attest?",
        text: "no. attesting is optional. your ships, score and streak work the same without it.",
      },
      {
        question: "is an attestation public?",
        text: "yes, and permanent. it links your wallet address to that ship for anyone to see, which is why only public ships can be attested.",
      },
    ],
  },
  {
    heading: "email",
    faqs: [
      {
        question: "what's the weekly ship recap?",
        text: "a monday email with the week's most shipped builders, fresh public releases and the longest streaks. sign up from the bottom of any page and confirm by email, or switch it on from your profile. every issue has a one-click unsubscribe.",
      },
      {
        question: "what other email will i get?",
        text: "one welcome email when you first sign in, and messages about your account if they're ever needed. nothing else, and we never sell or share your address.",
      },
    ],
  },
  {
    heading: "about outship",
    faqs: [
      {
        question: "how does outship relate to talent protocol?",
        text: "it complements talent protocol's builder score rather than competing with it: one honest signal among several.",
      },
      {
        question: "is outship open source?",
        text: "yes, under the apache license 2.0, on github at mojeebdev/outship. contributions are welcome; the contributing guide has the rules.",
        answer: (
          <>
            yes, under the apache license 2.0:{" "}
            <a href="https://github.com/mojeebdev/outship" className={link}>
              github.com/mojeebdev/outship
            </a>
            . contributions are welcome; the{" "}
            <a
              href="https://github.com/mojeebdev/outship/blob/main/CONTRIBUTING.md"
              className={link}
            >
              contributing guide
            </a>{" "}
            has the rules.
          </>
        ),
      },
      {
        question: "who's behind it?",
        text: "mojeeb titilayo, a creative product engineer in lagos, building through blindspotlab.",
        answer: (
          <>
            mojeeb titilayo, a creative product engineer in lagos, building
            through{" "}
            <a href="https://blindspotlab.xyz" className={link}>
              blindspotlab
            </a>
            . more on the{" "}
            <Link href="/about" className={link}>
              about page
            </Link>
            .
          </>
        ),
      },
      {
        question: "how do i report a bug or a security issue?",
        text: `bugs can go in a github issue. security issues should never be posted publicly: email ${SUPPORT_EMAIL} instead.`,
        answer: (
          <>
            bugs can go in a{" "}
            <a href="https://github.com/mojeebdev/outship/issues" className={link}>
              github issue
            </a>
            . security issues should never be posted publicly: email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
              {SUPPORT_EMAIL}
            </a>{" "}
            instead.
          </>
        ),
      },
    ],
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/faq#faq`,
  url: `${SITE_URL}/faq`,
  isPartOf: { "@id": SITE_ID.website },
  publisher: { "@id": SITE_ID.organization },
  mainEntity: groups.flatMap(({ faqs }) =>
    faqs.map(({ question, text }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text },
    })),
  ),
};

export default function FaqPage() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        // Built from the constants above, never from user input.
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-12 px-6 py-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-medium sm:text-4xl">faq</h1>
          <p className="text-text-muted-1">
            how outship works. anything missing?{" "}
            <Link href="/contact" className={link}>
              ask us
            </Link>
            .
          </p>
        </div>

        {groups.map(({ heading, faqs }) => (
          <section
            key={heading}
            id={heading.replace(/\s+/g, "-")}
            className="flex scroll-mt-24 flex-col gap-3"
          >
            <h2 className="text-xs uppercase tracking-wide text-text-muted-2">{heading}</h2>
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-white">
              {faqs.map(({ question, text, answer }) => (
                <details key={question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                    {question}
                    <span
                      aria-hidden="true"
                      className="text-xl leading-none text-text-muted-2 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pt-3 leading-relaxed text-text-muted-1">{answer ?? text}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SiteShell>
  );
}
