import { Bone, PageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeleton label="your recap" className="max-w-xl items-start gap-5 px-6 py-24">
      <Bone className="h-9 w-64 max-w-full" />
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-3/4" />
      <Bone className="h-10 w-40" round />
    </PageSkeleton>
  );
}
