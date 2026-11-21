import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { IconArrowRight } from "@/components/icons";
import { ProfilePageHeading } from "@/components/profile-page-heading";
import { ShipmarkCollection } from "@/components/shipmark-collection";
import { SiteShell } from "@/components/site-shell";
import { shipmarkCategory } from "@/lib/shipmark-categories";
import { publicShipmarks } from "@/lib/public-shipmarks";
import { builderForHandle, isClaimed } from "@/lib/builders";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 48;

type PageProps = {
  params: Promise<{ handle: string; category: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

async function publicBuilder(rawHandle: string) {
  const builder = await builderForHandle(await getDb(), rawHandle);
  return builder && !builder.hidden ? builder : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle, category: slug } = await params;
  const [builder, category] = await Promise.all([publicBuilder(handle), Promise.resolve(shipmarkCategory(slug))]);
  return {
    title: builder && category ? `${builder.githubLogin} · ${category.title} — outship` : "Public Shipmarks — outship",
    ...(builder && !isClaimed(builder) ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PublicShipmarkCategoryPage({ params, searchParams }: PageProps) {
  const { handle, category: slug } = await params;
  const category = shipmarkCategory(slug);
  if (!category) notFound();
  const builder = await publicBuilder(handle);
  if (!builder) notFound();

  const search = await searchParams;
  const requestedPage = Number(Array.isArray(search.page) ? search.page[0] : search.page);
  const { env } = await getCloudflareContext({ async: true });
  const allMarks = (await publicShipmarks(env.DB, builder.id)).filter((mark) => category.matches(mark.code));
  const total = allMarks.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, pageCount)
    : 1;
  const marks = allMarks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const profilePath = `/${encodeURIComponent(`@${builder.githubLogin}`)}`;
  const description = category.slug === "firsts"
    ? "The first milestones from this public shipping record. Counts come only from public repositories."
    : `${category.description} Counts come only from public repositories.`;

  return (
    <SiteShell>
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-12 sm:py-16">
        <div>
          <Link href={`${profilePath}/shipmarks`} className="inline-flex items-center gap-1 text-sm text-text-muted-1 transition hover:text-base-blue">
            <IconArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
            all public Shipmarks
          </Link>
          <ProfilePageHeading
            eyebrow={`@${builder.githubLogin} · public Shipmarks`}
            title={category.title}
            description={description}
          />
        </div>
        <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-white p-4 sm:p-5">
          <ShipmarkCollection marks={marks} total={total} publicView />
          {total > 0 && pageCount > 1 && (
            <nav aria-label="Public Shipmark pages" className="flex items-center justify-between border-t border-border pt-4 text-sm">
              {page > 1 ? <Link href={`${profilePath}/shipmarks/${category.slug}?page=${page - 1}`} className="inline-flex items-center gap-1 text-text-muted-1 transition hover:text-base-blue"><IconArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" /> newer</Link> : <span />}
              <span className="tabular-nums text-text-muted-2">page {page} of {pageCount}</span>
              {page < pageCount ? <Link href={`${profilePath}/shipmarks/${category.slug}?page=${page + 1}`} className="inline-flex items-center gap-1 text-text-muted-1 transition hover:text-base-blue">older <IconArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link> : <span />}
            </nav>
          )}
        </section>
      </main>
    </SiteShell>
  );
}
