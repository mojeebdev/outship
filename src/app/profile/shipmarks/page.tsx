import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { IconArrowUpRight, IconAward } from "@/components/icons";
import { ProfilePageHeading } from "@/components/profile-page-heading";
import { SHIPMARK_CATEGORIES } from "@/lib/shipmark-categories";
import { ensureWelcomeShipmark } from "@/lib/shipmarks";
import { getCurrentBuilder } from "@/lib/auth/current-builder";

export const metadata: Metadata = { title: "Shipmarks · profile — outship" };
export const dynamic = "force-dynamic";

type ShipmarkCount = { code: string; count: number };

export default async function ProfileShipmarksPage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;

  const { env } = await getCloudflareContext({ async: true });
  await ensureWelcomeShipmark(env.DB, builder.id);
  const rows = await env.DB.prepare(
    'SELECT "code", COUNT(*) AS count FROM "Shipmark" WHERE "builderId" = ?1 GROUP BY "code"',
  ).bind(builder.id).all<ShipmarkCount>();
  const counts = rows.results ?? [];
  const total = counts.reduce((sum, row) => sum + Number(row.count), 0);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="milestones" title="your Shipmarks" description="A clear home for every earned milestone, grouped by the way you shipped." />
      <section aria-labelledby="shipmark-categories-title" className="flex flex-col gap-4 rounded-xl border border-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-base-blue"><IconAward className="h-4 w-4" aria-hidden="true" /> earned records</p>
            <h2 id="shipmark-categories-title" className="mt-1 text-xl font-medium">browse by category</h2>
          </div>
          <p className="text-sm tabular-nums text-text-muted-1"><strong className="font-medium text-void">{total}</strong> earned</p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {SHIPMARK_CATEGORIES.map((category) => {
            const count = counts.reduce(
              (sum, row) => sum + (category.matches(row.code) ? Number(row.count) : 0),
              0,
            );
            return (
              <li key={category.slug}>
                <Link
                  href={`/profile/shipmarks/${category.slug}`}
                  className="group flex h-full min-h-40 flex-col justify-between gap-5 rounded-lg border border-border p-4 transition-colors hover:border-base-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-blue focus-visible:ring-offset-2 sm:p-5"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-base font-medium capitalize">{category.title}</span>
                      <span className="mt-1 block max-w-xs text-sm leading-5 text-text-muted-1">{category.description}</span>
                    </span>
                    <span className="shrink-0 text-2xl font-medium tabular-nums tracking-tight text-base-blue">{count}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                    <span className="text-text-muted-1">{category.cta}</span>
                    <IconArrowUpRight className="h-4 w-4 text-base-blue transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
