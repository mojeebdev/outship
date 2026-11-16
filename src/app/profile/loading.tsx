import { Bone, ChartSkeleton, KpiSkeleton, PageSkeleton } from "@/components/skeletons";

// Shaped like the signed-in dashboard: the header, the section list on the
// left (wide screens), then the numbers and the 30-day chart.
export default function Loading() {
  return (
    <PageSkeleton label="your profile" className="max-w-6xl gap-6 px-6 pb-16 pt-4 sm:pt-6">
      <div className="flex items-center gap-4">
        <Bone className="h-14 w-14 shrink-0" round />
        <span className="flex flex-col gap-2">
          <Bone className="h-6 w-48" />
          <Bone className="h-4 w-56 max-w-full" />
        </span>
      </div>
      <div className="grid gap-8 lg:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="hidden flex-col gap-2 lg:flex">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-6">
          <KpiSkeleton className="sm:grid-cols-2 xl:grid-cols-4" />
          <ChartSkeleton />
        </div>
      </div>
    </PageSkeleton>
  );
}
