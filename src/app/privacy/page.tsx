import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "privacy — outship",
};

const UPDATED = "november 14, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20 leading-relaxed">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium sm:text-4xl">privacy policy</h1>
          <p className="text-sm text-text-muted-2">last updated {UPDATED}</p>
        </div>

        <p className="text-text-muted-1">
          this covers outship (outship.dev) and word (word.outship.dev), both
          run by BlindspotLab Limited. short version: we keep what&apos;s
          needed to show what you shipped, nothing is sold, there are no
          analytics or ad trackers, and anything you put onchain is public
          and permanent.
        </p>

        <Section title="when you sign in with github">
          <p>
            we store your github user id and username, and the id of your
            outship github app installation. github gives us a temporary
            token during sign-in; we use it to read your profile and which
            installations you can see, then discard it. we never store it.
          </p>
        </Section>

        <Section title="ships">
          <p>
            for repositories where the outship github app is installed, we
            record published releases, pull requests merged into the default
            branch, and pushes to it: the repository name, the release tag or
            pull request number, the commit, the time, and whether the
            repository is private. you choose which repositories the app can
            see, and can change that on github at any time.
          </p>
          <p>
            ships from public repositories appear on your public profile and
            the leaderboard. ships from private repositories count toward
            your score, but their repository name and tag are never shown
            publicly; only you see them, on your own dashboard.
          </p>
          <p>
            if you author a merged pull request or a release in a repository
            where someone else installed the app, that ship and your public
            github username may appear on outship even if you never signed
            up. email us and we&apos;ll remove it.
          </p>
        </Section>

        <Section title="onchain attestations">
          <p>
            attesting a ship is optional. if you do, your wallet signs a
            transaction on base, and the attestation (your wallet address,
            the repository, ship type, identifier, commit, time and score)
            becomes public and permanent on the blockchain. that links your
            wallet to your ships for anyone to see. we store the
            attestation&apos;s id and transaction hash. nobody, including us,
            can delete or edit data once it&apos;s onchain.
          </p>
        </Section>

        <Section title="email">
          <p>
            if you join the weekly ship recap, we store your email address
            and use it only to send outship email: a welcome, the weekly
            recap, and messages about your account. every recap includes an
            unsubscribe link, or email us to be removed.
          </p>
        </Section>

        <Section title="word">
          <p>
            when you count a page, we fetch it from our servers and store the
            address (with any query string removed), the counts, and the
            time, so the result has a shareable link. a site only appears on
            word&apos;s leaderboard if someone opts it in. to stop abuse, we
            use your ip address for rate limiting and hold it for up to an
            hour.
          </p>
        </Section>

        <Section title="cookies">
          <p>
            only what sign-in needs: a signed session cookie that lasts 30
            days, and a short-lived cookie that protects the github sign-in
            step for 10 minutes. no analytics, advertising or tracking
            cookies.
          </p>
        </Section>

        <Section title="who else handles data">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>cloudflare: hosting, our database, and sending email</li>
            <li>github: sign-in, and the ship data its app sends us</li>
            <li>base and the ethereum attestation service: attestations you choose to make</li>
            <li>zoho: our support inbox</li>
          </ul>
          <p>we don&apos;t sell or rent your data to anyone.</p>
        </Section>

        <Section title="your choices">
          <p>
            you can uninstall the github app or narrow its repositories on
            github, unsubscribe from email, and ask us to delete your account,
            ships and email address by writing to{" "}
            <a href="mailto:support@mail.outship.dev" className="text-base-blue hover:underline">
              support@mail.outship.dev
            </a>
            . onchain attestations can&apos;t be deleted by anyone.
          </p>
        </Section>

        <Section title="changes">
          <p>
            if this policy changes, we&apos;ll update it here and change the
            date at the top. questions:{" "}
            <Link href="/contact" className="text-base-blue hover:underline">
              contact
            </Link>
            .
          </p>
        </Section>
      </article>
    </SiteShell>
  );
}
