import Link from "next/link";
import { IconArrowUpRight } from "@/components/icons";
import { ShipmarkCollection, type Shipmark } from "@/components/shipmark-collection";

export function PublicShipmarksSection({
  marks,
  githubLogin,
}: {
  marks: Shipmark[];
  githubLogin: string;
}) {
  const profilePath = `/${encodeURIComponent(`@${githubLogin}`)}`;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-base-blue">Public repository activity</p>
          <h2 className="mt-1 text-xl font-medium">Shipmarks</h2>
          <p className="mt-1 text-sm text-text-muted-1">Milestones calculated only from public repositories.</p>
        </div>
        <Link
          href={`${profilePath}/shipmarks`}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-base-blue hover:underline"
        >
          browse by category
          <IconArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="rounded-lg border border-border p-3 sm:p-4">
        <ShipmarkCollection
          marks={marks.slice(0, 4)}
          total={marks.length}
          publicView
          title="recent public Shipmarks"
        />
      </div>
    </section>
  );
}
