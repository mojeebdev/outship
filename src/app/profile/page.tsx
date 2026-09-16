import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { IconNode } from "@/components/icons";

export const metadata: Metadata = {
  title: "profile — outship",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const builder = await getCurrentBuilder();

  if (builder) {
    redirect(`/@${builder.githubLogin}`);
  }

  return (
    <SiteShell>
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-tint">
          <IconNode className="h-6 w-6 text-base-blue" />
        </span>
        <h1 className="text-3xl font-medium sm:text-4xl">your builder profile</h1>
        <p className="text-base text-text-muted-1 sm:text-lg">
          connect github to see your streak, ships, and score.
        </p>
        <Link
          href="/api/auth/github/login"
          className="mt-2 rounded-md bg-base-blue px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          connect github →
        </Link>
      </section>
    </SiteShell>
  );
}
