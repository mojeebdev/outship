import { HeadingSkeleton, PageSkeleton, RowsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton label="streaks" className="max-w-3xl gap-8 px-6 py-16">
      <HeadingSkeleton />
      <RowsSkeleton count={10} />
    </PageSkeleton>
  );
}
