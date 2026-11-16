import { Bone, HeadingSkeleton, PageSkeleton, TabsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton label="the builder index" className="max-w-3xl gap-8 px-6 py-16">
      <HeadingSkeleton />
      <TabsSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4">
            <Bone className="h-10 w-10" round />
            <Bone className="h-5 w-24 max-w-full" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
