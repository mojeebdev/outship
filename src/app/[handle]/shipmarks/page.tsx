import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { IconArrowRight, IconArrowUpRight } from "@/components/icons";
import { ProfilePageHeading } from "@/components/profile-page-heading";
import { SiteShell } from "@/components/site-shell";
import { SHIPMARK_CATEGORIES } from "@/lib/shipmark-categories";
import { publicShipmarks } from "@/lib/public-shipmarks";
import { builderForHandle, isClaimed } from "@/lib/builders";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ handle: string }> };

async function publicBuilder(rawHandle: string) {
  const builder = await builderForHandle(await getDb(), rawHandle);
  return builder && !builder.hidden ? builder : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const builder = await publicBuilder(handle);
  return {
    title: builder ? `${builder.githubLogin}'s public Shipmarks — outship` : "Public Shipmarks — outship",
    ...(builder && !isClaimed(builder) ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PublicShipmarksPage({ params }: PageProps) {
  const { handle } = await params;
  const builder = await publicBuilder(handle);
  if (!builder) notFound();

  const { env } = await getCloudflareContext({ async: true });
  const marks = await publicShipmarks(env.DB, builder.id);
  const profilePath = `/${encodeURIComponent(`@${builder.githubLogin}`)}`;

  return (
    <SiteShell>
      <main className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-12 sm:py-16">
        <div>
          <Link href={profilePath} className="inline-flex items-center gap-1 text-sm text-text-muted-1 transition hover:text-base-blue">
            <IconArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
            @{builder.githubLogin}&apos;s profile
          </Link>
          <ProfilePageHeading
            eyebrow="public record"
            title={`${builder.githubLogin}'s Shipmarks`}
            description="Achievements derived only from ships in public repositories."
          />
        </div>

        <section aria-labelledby="public-shipmark-categories" className="flex flex-col gap-4 rounded-xl border border-border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-base-blue">Public repository activity</p>
              <h2 id="public-shipmark-categories" className="mt-1 text-xl font-medium">browse by category</h2>
            </div>
            <p className="text-sm tabular-nums text-text-muted-1"><strong className="font-medium text-void">{marks.length}</strong> earned</p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {SHIPMARK_CATEGORIES.map((category) => {
              const count = marks.filter((mark) => category.matches(mark.code)).length;
              const cta = category.slug === "firsts" ? "Browse firsts" : category.cta;
              return (
                <li key={category.slug}>
                  <Link
                    href={`${profilePath}/shipmarks/${category.slug}`}
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
                      <span className="text-text-muted-1">{cta}</span>
                      <IconArrowUpRight className="h-4 w-4 text-base-blue transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </SiteShell>
  );
}
