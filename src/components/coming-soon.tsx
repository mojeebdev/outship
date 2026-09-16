import Link from "next/link";
import type { ComponentType } from "react";
import type { IconProps } from "@/components/icons";

export function ComingSoon({
  Icon,
  title,
  description,
  note,
}: {
  Icon: ComponentType<IconProps>;
  title: string;
  description: string;
  note: string;
}) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-tint">
        <Icon className="h-6 w-6 text-base-blue" />
      </span>
      <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-text-muted-1">
        coming soon
      </span>
      <h1 className="text-3xl font-medium sm:text-4xl">{title}</h1>
      <p className="text-base text-text-muted-1 sm:text-lg">{description}</p>
      <p className="max-w-md text-sm text-text-muted-2">{note}</p>
      <Link
        href="/changelog"
        className="mt-2 text-sm font-medium text-base-blue hover:underline"
      >
        follow progress in the changelog →
      </Link>
    </section>
  );
}
