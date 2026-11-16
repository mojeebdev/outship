import type { Metadata } from "next";
import Link from "next/link";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { SiteShell } from "@/components/site-shell";
import { getDb } from "@/lib/db";
import { IconShip, IconStreak } from "@/components/icons";
import { PUBLIC_BUILDER } from "@/lib/builders";
import { BuilderAvatar, UnclaimedChip } from "@/components/builder-bits";

export const metadata: Metadata = {
  title: "index — outship",
};

export const dynamic = "force-dynamic";

// All first; claimed (signed in) and unclaimed (created because they shipped
// in a repo with the App, never signed in) as filters, with their counts.
const FILTERS = [
  { key: "all", label: "all" },
  { key: "claimed", label: "claimed" },
  { key: "unclaimed", label: "unclaimed" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

function parseFilter(value: unknown): Filter {
  return value === "claimed" || value === "unclaimed" ? value : "all";
}

export default async function IndexPage({ searchParams }: { searchParams: Promise<{ show?: string | string[] }> }) {
  const show = parseFilter((await searchParams).show);
  const db = await getDb();
  const everyone = await db.builder.findMany({
    where: PUBLIC_BUILDER,
    orderBy: { githubLogin: "asc" },
    select: {
      githubId: true,
      githubLogin: true,
      claimedAt: true,
      currentStreak: true,
      _count: { select: { ships: true } },
    },
  });
  const counts: Record<Filter, number> = {
    all: everyone.length,
    claimed: everyone.filter((builder) => builder.claimedAt).length,
    unclaimed: everyone.filter((builder) => !builder.claimedAt).length,
  };
  const builders =
    show === "all" ? everyone : everyone.filter((builder) => (show === "claimed") === Boolean(builder.claimedAt));

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-medium sm:text-4xl">the builder index</h1>
          <p className="mt-2 text-text-muted-1">
            every builder on outship, browsable by repo, streak, and score.
          </p>
        </div>

        {everyone.length > 0 && (
          <nav aria-label="filter builders" className="flex gap-1 rounded-lg border border-border bg-white p-1 text-sm">
            {FILTERS.map(({ key, label }) => (
              <Link
                key={key}
                href={key === "all" ? "/builders" : `/builders?show=${key}`}
                aria-current={key === show ? "page" : undefined}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 font-medium transition ${
                  key === show ? "bg-base-blue text-white" : "text-text-muted-1 hover:text-base-blue"
                }`}
              >
                {label}
                <span className={`text-xs ${key === show ? "text-white/70" : "text-text-muted-2"}`}>{counts[key]}</span>
              </Link>
            ))}
          </nav>
        )}

        {everyone.length > 0 && builders.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
            {show === "claimed" ? "nobody has signed in yet." : "no unclaimed profiles right now: everyone here has signed in."}
          </p>
        ) : builders.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
            the directory opens once the first cohort connects github —{" "}
            <ConnectGithubButton variant="link">be the first</ConnectGithubButton>
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {builders.map((builder) => (
              <Link
                key={builder.githubLogin}
                href={`/@${builder.githubLogin}`}
                className={`flex flex-col gap-3 rounded-lg border border-border p-4 transition hover:border-base-blue ${
                  builder.claimedAt ? "bg-white" : "bg-white/50 text-text-muted-1"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <BuilderAvatar githubId={builder.githubId} login={builder.githubLogin} />
                  {!builder.claimedAt && <UnclaimedChip />}
                </span>
                <span className="truncate font-medium">{builder.githubLogin}</span>
                <div className="flex items-center gap-3 text-xs text-text-muted-1">
                  <span className="flex items-center gap-1">
                    <IconStreak className="h-3 w-3" />
                    {builder.currentStreak}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconShip className="h-3 w-3" />
                    {builder._count.ships}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
