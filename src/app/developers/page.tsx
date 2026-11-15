import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { ANONYMOUS_LIMITS } from "@/lib/api/guard";
import { SITE_URL } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "developers — outship",
  description: "outship's public API: verified shipping records from GitHub, for verification and reputation.",
};

const SUPPORT_EMAIL = "support@mail.outship.dev";
const BASE = `${SITE_URL}/api/v1`;

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-white p-4 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, children }: { method: string; path: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-mono text-sm">
        <span className="mr-2 rounded bg-blue-tint px-1.5 py-0.5 text-base-blue">{method}</span>
        {path}
      </h3>
      {children}
    </section>
  );
}

export default function DevelopersPage() {
  const anonMinute = ANONYMOUS_LIMITS.find((limit) => limit.name === "minute")?.max;
  const anonDay = ANONYMOUS_LIMITS.find((limit) => limit.name === "day")?.max;
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-20 leading-relaxed">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-medium sm:text-4xl">the outship API</h1>
          <p className="text-lg text-text-muted-1">
            verified shipping records, straight from github: who shipped what, when, and whether it&apos;s
            attested onchain. for hiring checks, grant reviews, community reputation, or anything that needs
            to know someone ships rather than take their word for it.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium">the basics</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>
              base url <code className="rounded bg-cream px-1">{BASE}</code>. JSON in, JSON out, GET only.
            </li>
            <li>
              no key needed to try it: {anonMinute} requests a minute and {anonDay} a day per IP address.
            </li>
            <li>
              with a key, send <code className="rounded bg-cream px-1">Authorization: Bearer os_live_…</code>{" "}
              for your own, higher limit. keys are free while the API is new: email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=outship%20API%20key`} className="text-base-blue hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              with who you are and what you&apos;re building.
            </li>
            <li>
              public data only. ships from private repos count toward a builder&apos;s score but are never listed
              or confirmed, and builders who hid their profile don&apos;t exist here.
            </li>
            <li>
              errors look like <code className="rounded bg-cream px-1">{"{ \"error\": \"…\" }"}</code> with the
              usual status codes; 429 comes with a <code className="rounded bg-cream px-1">Retry-After</code>.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className="text-xl font-medium">endpoints</h2>

          <Endpoint method="GET" path="/builders/{login}">
            <p className="text-sm text-text-muted-1">
              a builder&apos;s score, tier, streaks, ranks this week and all time, ship counts and attestations.
              unclaimed builders (who never signed in) are included, with <code>claimed: false</code> and no rank.
            </p>
            <Code>{`curl ${BASE}/builders/mojeebdev`}</Code>
            <Code>{`{
  "builder": {
    "login": "mojeebdev",
    "claimed": true,
    "score": 410,
    "tier": { "name": "deckhand", "next": "sailor", "pointsToNext": 90 },
    "streak": { "current": 12, "longest": 12 },
    "ranks": { "week": 1, "allTime": 1 },
    "ships": { "total": 17, "releases": 3, "merges": 2, "pushes": 12 },
    "attestations": 2,
    "profileUrl": "${SITE_URL}/@mojeebdev",
    "badgeUrl": "${SITE_URL}/@mojeebdev/badge.svg"
  }
}`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/builders/{login}/ships?limit=25&type=release&before=…">
            <p className="text-sm text-text-muted-1">
              public ships, newest first. <code>type</code> is release, merge or push; page with{" "}
              <code>before</code> set to the <code>next</code> value of the previous page. each ship has its
              points (before daily caps) and, if attested, the onchain receipt.{" "}
              <code>attestation.verified</code> is true for receipts outship signed and checked.
            </p>
            <Code>{`curl "${BASE}/builders/mojeebdev/ships?type=release&limit=2"`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/verify?login=&repo=&type=&identifier=">
            <p className="text-sm text-text-muted-1">
              did this person ship this? with <code>type</code> and <code>identifier</code> (a tag, a PR number,
              or a push&apos;s UTC day) it checks one ship; without them, whether they shipped anything in that
              repo. a private repo always answers <code>verified: false</code>.
            </p>
            <Code>{`curl "${BASE}/verify?login=mojeebdev&repo=mojeebdev/outship&type=release&identifier=v0.1.0"`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/leaderboard?period=week&language=&page=1">
            <p className="text-sm text-text-muted-1">
              the same boards as{" "}
              <Link href="/leaderboard" className="text-base-blue hover:underline">
                the leaderboard
              </Link>
              : <code>week</code> (from monday 00:00 UTC), <code>month</code> or <code>all</code>, 50 a page.
            </p>
          </Endpoint>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium">checking it without us</h2>
          <p className="text-sm">
            an attested ship is an attestation on base through the ethereum attestation service. its{" "}
            <code>attestation.url</code> opens it on easscan, and anyone can read it from the EAS contract
            directly, so a receipt doesn&apos;t depend on outship or this API staying up.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium">fair use</h2>
          <p className="text-sm">
            don&apos;t use the API to contact builders who haven&apos;t opted in, to rebuild outship&apos;s
            leaderboard as your own product, or to imply outship endorses anyone. see the{" "}
            <Link href="/terms" className="text-base-blue hover:underline">
              terms
            </Link>
            . the API is versioned: breaking changes get a new version, with notice.
          </p>
        </section>
      </article>
    </SiteShell>
  );
}
