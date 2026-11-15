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
            we store your github user id and username, the id of your
            outship github app installation, the primary verified email
            address on your github account, and the public profile fields
            you&apos;ve set on github: name, bio, location, website and x
            username. those profile fields are shown on your public profile,
            and refreshed each time you sign in. github gives us a temporary
            token during sign-in; we use it to read your profile, that email
            address, which installations you can see and your contribution
            history, then discard it. we never store it.
          </p>
          <p>
            the contribution history is what github&apos;s own contribution
            graph shows: how many contributions you made on each day of the
            last year, and totals for commits, pull requests, reviews and
            private contributions. no repository names. we refresh it at most
            once a day, when you sign in, and show it on your profile as
            context. it never affects your score, streak or rank.
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
            when the app is installed, or gains a repository, we also import
            the last 12 months of that repository&apos;s published releases
            and merged pull requests, with the same details, so your history
            counts from day one. pushes can&apos;t be imported. imported ships
            are marked as imported, and they never trigger the one-time claim
            comment.
          </p>
          <p>
            ships from public repositories appear on your public profile and
            the leaderboard. ships from private repositories count toward
            your score, but their repository name and tag are never shown
            publicly; only you see them, on your own dashboard.
          </p>
        </Section>

        <Section title="unclaimed profiles">
          <p>
            if you author a merged pull request, a release or a push in a
            repository where someone else installed the app, that ship is
            credited to you, and outship shows it on a profile at your github
            username even if you&apos;ve never signed up. that profile is
            clearly marked unclaimed, holds only public github activity (your
            username, avatar and ships from public repositories), isn&apos;t
            ranked, and asks search engines not to index it. we don&apos;t
            have your email address or anything else about you.
          </p>
          <p>
            the first time one of your pull requests is merged in a public
            repository whose owner allows it, the outship github app may leave
            one short comment on that pull request saying the profile exists
            and how to claim or hide it. it happens at most once per person,
            ever, and repository owners can switch it off. we never use commit
            email addresses to contact anyone.
          </p>
          <p>
            to take a profile down, sign in with github and switch on
            &ldquo;hide my profile&rdquo;: the public page then returns not
            found and you disappear from the leaderboard, index and streaks,
            while your ships keep counting privately. or email us and
            we&apos;ll remove it.
          </p>
        </Section>

        <Section title="onchain attestations">
          <p>
            attesting a ship is optional. if you do, we store the wallet
            address you attest with on your account (one per profile), sign
            the ship&apos;s details with outship&apos;s key, and your wallet
            sends a transaction on base. the attestation (your wallet
            address, the repository, ship type, identifier, commit, time,
            score, your github username and outship&apos;s id for the ship)
            becomes public and permanent on the blockchain. that links your
            wallet and username to your ships for anyone to see. we store the
            attestation&apos;s id and transaction hash after reading them back
            from base. nobody, including us, can delete or edit data once
            it&apos;s onchain.
          </p>
        </Section>

        <Section title="the API">
          <p>
            outship&apos;s public API returns the same public information as
            outship&apos;s public pages: your username, avatar, score, tier,
            streaks, ranks and ships from public repositories. it never lists
            or confirms ships from private repositories, and a hidden profile
            doesn&apos;t appear in it. for API keys we store their name, who
            they were issued to, a hash of the key, and a daily request count.
            we use the IP address of requests made without a key for rate
            limiting, held for up to two days.
          </p>
        </Section>

        <Section title="email">
          <p>
            we only use email addresses to send outship email, never for
            ads, and we never sell or share them.
          </p>
          <p>
            if you signed in with github, we send one welcome email and,
            when needed, messages about your account. the weekly ship recap
            is off until you switch it on from your profile.
          </p>
          <p>
            if you join the weekly ship recap from the signup form, we store
            your email address and send one email asking you to confirm. the
            recap only starts once you do; if you don&apos;t, you won&apos;t
            hear from us again. every recap has a one-click unsubscribe link,
            and you can always email us to be removed. we keep a record that
            an address unsubscribed so it stays unsubscribed.
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
            days, a cookie with no data in it that tells the menu you&apos;re
            signed in, and a short-lived cookie that protects the github
            sign-in step for 10 minutes. no analytics, advertising or tracking
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
            github, hide your profile from your dashboard, switch off claim
            invitations in your repositories, unsubscribe from email, and ask
            us to delete your account,
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
