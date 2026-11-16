import { ChartSkeleton, HeadingSkeleton, KpiSkeleton, PageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton label="outship in numbers" className="max-w-5xl gap-8 px-6 py-16">
      <HeadingSkeleton wide />
      <KpiSkeleton />
      <KpiSkeleton count={3} className="sm:grid-cols-3" />
      <ChartSkeleton />
    </PageSkeleton>
  );
}
