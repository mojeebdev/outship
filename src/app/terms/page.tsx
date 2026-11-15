import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "terms — outship",
};

const UPDATED = "november 15, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20 leading-relaxed">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium sm:text-4xl">terms of service</h1>
          <p className="text-sm text-text-muted-2">last updated {UPDATED}</p>
        </div>

        <p className="text-text-muted-1">
          these terms cover outship (outship.dev) and word (word.outship.dev),
          run by BlindspotLab Limited. by using either, you agree to them. see
          also the{" "}
          <Link href="/privacy" className="text-base-blue hover:underline">
            privacy policy
          </Link>
          .
        </p>

        <Section title="your account">
          <p>
            you sign in with github, and you&apos;re responsible for what
            happens under your account. only connect repositories you have
            the right to share activity from.
          </p>
        </Section>

        <Section title="fair play">
          <p>
            outship ranks real shipping. don&apos;t try to game it: no
            scripted or empty releases, self-merged pull requests made to
            farm points, fake accounts, or impersonating someone else. daily
            caps already limit what counts, and we may also remove ships,
            reset scores, or remove builders that abuse the system.
          </p>
        </Section>

        <Section title="unclaimed profiles">
          <p>
            if you ship in a repository where the outship app is installed,
            your public activity there can appear on an unclaimed profile
            before you sign up. signing in claims it. you can hide it at any
            time from your dashboard, or ask us to remove it. if you install
            the app, its one-time claim comment may appear on merged pull
            requests in your public repositories unless you switch it off on
            your profile.
          </p>
        </Section>

        <Section title="scores and rankings">
          <p>
            scores, streaks and ranks are computed from github activity by
            rules we publish and may change to keep the board fair. they
            measure shipping activity; they aren&apos;t an endorsement of
            anyone or their work.
          </p>
        </Section>

        <Section title="onchain attestations">
          <p>
            attesting a ship is optional and sends a transaction from your own
            wallet on base, paid for with your own gas. attestations are
            public and permanent: they can&apos;t be edited or deleted by you
            or by us. we don&apos;t control base or the ethereum attestation
            service, and nothing on outship is financial advice.
          </p>
        </Section>

        <Section title="word">
          <p>
            only count pages you&apos;re allowed to access. results are saved
            with a shareable link, and anyone with that link can see the
            address and the counts.
          </p>
        </Section>

        <Section title="the API">
          <p>
            the outship API (outship.dev/developers) serves public shipping
            data. API keys are personal to whoever they were issued to; keep
            them secret, and we may revoke a key that&apos;s shared, abused or
            used against these terms. don&apos;t use the API to contact
            builders who haven&apos;t opted in, to republish outship&apos;s
            leaderboard as your own product, or to suggest outship endorses
            anyone. we may change rate limits, and breaking changes get a new
            API version, with notice.
          </p>
        </Section>

        <Section title="your content">
          <p>
            your code stays yours. you let us store and display the ship data
            github sends us, so we can show your profile, the leaderboard and
            share cards.
          </p>
        </Section>

        <Section title="the service">
          <p>
            outship is provided as is. we work to keep it running and
            accurate, but we can&apos;t promise it will always be available or
            error-free, and to the extent the law allows we aren&apos;t liable
            for losses from using it. we may change or end features, and
            suspend accounts that break these terms.
          </p>
        </Section>

        <Section title="changes and contact">
          <p>
            if these terms change, we&apos;ll update them here and change the
            date at the top. questions:{" "}
            <a href="mailto:support@mail.outship.dev" className="text-base-blue hover:underline">
              support@mail.outship.dev
            </a>
            .
          </p>
        </Section>
      </article>
    </SiteShell>
  );
}
