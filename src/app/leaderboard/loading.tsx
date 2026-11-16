import { Bone, HeadingSkeleton, PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/skeletons";

// Shared by /leaderboard, /leaderboard/month and /leaderboard/all.
export default function Loading() {
  return (
    <PageSkeleton label="the leaderboard" className="max-w-3xl gap-8 px-6 py-16">
      <HeadingSkeleton />
      <TabsSkeleton />
      <Bone className="-mt-4 h-4 w-64 max-w-full" />
      <TabsSkeleton />
      <RowsSkeleton count={10} />
    </PageSkeleton>
  );
}
