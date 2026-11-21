import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { IconArrowRight } from "@/components/icons";
import { ProfilePageHeading } from "@/components/profile-page-heading";
import { ShipmarkCollection, type Shipmark } from "@/components/shipmark-collection";
import { shipmarkCategory } from "@/lib/shipmark-categories";
import { ensureWelcomeShipmark } from "@/lib/shipmarks";
import { getCurrentBuilder } from "@/lib/auth/current-builder";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 48;

type PageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = shipmarkCategory(slug);
  return { title: category ? `${category.title} · Shipmarks — outship` : "Shipmarks — outship" };
}

export default async function ShipmarkCategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const category = shipmarkCategory(slug);
  if (!category) notFound();

  const builder = await getCurrentBuilder();
  if (!builder) return null;

  const search = await searchParams;
  const requestedPage = Number(Array.isArray(search.page) ? search.page[0] : search.page);
  const { env } = await getCloudflareContext({ async: true });
  await ensureWelcomeShipmark(env.DB, builder.id);

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM "Shipmark" WHERE "builderId" = ?1 AND ${category.sql}`,
  ).bind(builder.id).first<{ total: number }>();
  const total = Number(countRow?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, pageCount)
    : 1;
  const rows = await env.DB.prepare(
    `SELECT "id", "code", "period", "earnedAt", "snapshot" FROM "Shipmark" WHERE "builderId" = ?1 AND ${category.sql} ORDER BY "earnedAt" DESC LIMIT ${PAGE_SIZE} OFFSET ?2`,
  ).bind(builder.id, (page - 1) * PAGE_SIZE).all<Shipmark>();
  const marks = (rows.results ?? []).map((mark) => ({ ...mark, earnedAt: String(mark.earnedAt), snapshot: String(mark.snapshot) }));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div>
        <Link href="/profile/shipmarks" className="inline-flex items-center gap-1 text-sm text-text-muted-1 transition hover:text-base-blue"><IconArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" /> all Shipmarks</Link>
        <ProfilePageHeading eyebrow="Shipmark category" title={category.title} description={category.description} />
      </div>
      <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-white p-4 sm:p-5">
        <ShipmarkCollection marks={marks} total={total} />
        {total > 0 && pageCount > 1 && (
          <nav aria-label="Shipmark pages" className="flex items-center justify-between border-t border-border pt-4 text-sm">
            {page > 1 ? <Link href={`/profile/shipmarks/${category.slug}?page=${page - 1}`} className="inline-flex items-center gap-1 text-text-muted-1 transition hover:text-base-blue"><IconArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" /> newer</Link> : <span />}
            <span className="tabular-nums text-text-muted-2">page {page} of {pageCount}</span>
            {page < pageCount ? <Link href={`/profile/shipmarks/${category.slug}?page=${page + 1}`} className="inline-flex items-center gap-1 text-text-muted-1 transition hover:text-base-blue">older <IconArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link> : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}
