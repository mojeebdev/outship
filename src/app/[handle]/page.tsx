import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getDb } from "@/lib/db";
import { IconGrid, IconSeal, IconShip, IconStreak } from "@/components/icons";
import { AttestationBadge } from "@/components/attestation-badge";

export const dynamic = "force-dynamic";

async function loadBuilder(rawHandle: string) {
  // The dynamic segment can arrive percent-encoded (e.g. "%40mojeebdev")
  // depending on the runtime, rather than pre-decoded like plain Next.js.
  const handle = decodeURIComponent(rawHandle);
  if (!handle.startsWith("@")) return null;
  const githubLogin = handle.slice(1);
  if (!githubLogin) return null;

  const db = await getDb();
  return db.builder.findUnique({ where: { githubLogin } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const builder = await loadBuilder(handle);
  if (!builder) return { title: "outship" };
  return { title: `${builder.githubLogin} — outship` };
}

/**
 * A purely public profile — anyone can view this, logged in or not, and
 * it never branches on who's viewing. Your own private dashboard (with
 * log out, etc.) lives separately at /profile.
 */
export default async function BuilderProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const builder = await loadBuilder(handle);
  if (!builder) notFound();

  const db = await getDb();
  const [rankAbove, totalShips, recentShips] = await Promise.all([
    db.builder.count({ where: { score: { gt: builder.score } } }),
    db.ship.count({ where: { builderId: builder.id } }),
    db.ship.findMany({
      where: { builderId: builder.id },
      orderBy: { shippedAt: "desc" },
      take: 20,
      include: { attestation: true },
    }),
  ]);

  const stats = [
    { label: "streak", value: builder.currentStreak, Icon: IconStreak },
    { label: "ships", value: totalShips, Icon: IconShip },
    { label: "rank", value: `#${rankAbove + 1}`, Icon: IconGrid },
    { label: "score", value: builder.score, Icon: IconSeal },
  ];

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <h1 className="text-2xl font-medium">{builder.githubLogin}</h1>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded bg-blue-tint">
                <Icon className="h-4 w-4 text-base-blue" />
              </span>
              <span className="text-2xl font-medium">{value}</span>
              <span className="text-sm text-text-muted-1">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">ship feed</h2>
          {recentShips.length === 0 ? (
            <p className="text-sm text-text-muted-1">
              nothing shipped yet — merge a PR or publish a release and
              it&apos;ll show up here.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {recentShips.map((ship) => (
                <li
                  key={ship.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-white p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-cream">
                    <IconShip className="h-4 w-4 text-void" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {ship.shipType === "RELEASE" ? "release" : "merge"} ·{" "}
                      {ship.repo}
                    </span>
                    <span className="text-xs text-text-muted-2">
                      {ship.identifier}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted-2">
                    {ship.shippedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {ship.attestation && (
                    <AttestationBadge
                      chain={ship.attestation.chain}
                      easUid={ship.attestation.easUid}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
