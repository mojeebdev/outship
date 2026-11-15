import Link from "next/link";
import { BuilderAvatar, UnclaimedChip } from "@/components/builder-bits";
import { IconArrowRight, IconStreak } from "@/components/icons";
import { getDb } from "@/lib/db";
import { PUBLIC_BUILDER } from "@/lib/builders";
import { shipDetail, shipLabel } from "@/lib/ships";

// Five is a glance at the latest; the leaderboard has the rest.
const FEED_SIZE = 5;

function ago(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The latest public ships on outship, live from the database. */
export async function LiveShipFeed() {
  const db = await getDb();
  const ships = await db.ship.findMany({
    where: { isPrivate: false, builder: PUBLIC_BUILDER },
    orderBy: { shippedAt: "desc" },
    take: FEED_SIZE,
    select: {
      id: true,
      repo: true,
      shipType: true,
      identifier: true,
      commitSha: true,
      shippedAt: true,
      builder: { select: { githubId: true, githubLogin: true, claimedAt: true } },
    },
  });
  const now = new Date();

  return (
    <section aria-labelledby="feed-heading" className="px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <h2 id="feed-heading" className="text-2xl font-medium">shipped just now</h2>
          <p className="mt-1 text-sm text-text-muted-1">
            the latest public ships, as github reported them. private repos count, but never show here.
          </p>
        </div>

        {ships.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
            nothing shipped yet. the first ship lands here the moment github reports it.
          </p>
        ) : (
          // One ship per row, newest first, so the feed reads top to bottom
          // like a log of what just happened.
          <ol className="flex flex-col gap-2">
            {ships.map((ship) => (
              <li key={ship.id}>
                <Link
                  href={`/@${ship.builder.githubLogin}`}
                  className={`flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition hover:border-base-blue sm:gap-4 ${
                    ship.builder.claimedAt ? "bg-white" : "bg-white/50"
                  }`}
                >
                  <BuilderAvatar githubId={ship.builder.githubId} login={ship.builder.githubLogin} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium sm:w-56 sm:shrink-0">
                      <span className="truncate">{ship.builder.githubLogin}</span>
                      {!ship.builder.claimedAt && <UnclaimedChip />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text-muted-1">
                      {shipLabel(ship)} · {ship.repo}
                    </span>
                    <span className="truncate text-xs text-text-muted-2 sm:shrink-0 sm:text-right">
                      {shipDetail(ship)} · {ago(ship.shippedAt, now)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <Link
          href="/leaderboard"
          className="inline-flex items-center justify-center gap-2.5 self-center rounded-md bg-void px-6 py-3 text-sm font-medium text-white transition hover:bg-base-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-void"
        >
          <IconStreak className="h-5 w-5 shrink-0" aria-hidden="true" />
          see the leaderboard
          <IconArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
