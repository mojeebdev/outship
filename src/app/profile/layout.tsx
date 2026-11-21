import type { ReactNode } from "react";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { BuilderAvatar } from "@/components/builder-bits";
import { ProfileSidebar } from "@/components/profile-sidebar";
import { IconArrowUpRight, IconGithub, IconLogout, IconNode, IconX } from "@/components/icons";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import { profileShareText, shareOnXHref } from "@/lib/share";
import { tierFor } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const builder = await getCurrentBuilder();
  return (
    <SiteShell>
      {!builder ? (
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-tint">
            <IconNode className="h-6 w-6 text-base-blue" aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-medium sm:text-4xl">your builder profile</h1>
          <p className="text-base text-text-muted-1 sm:text-lg">connect github to see your streak, ships, and score.</p>
          <div className="mt-2"><ConnectGithubButton /></div>
        </section>
      ) : (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-16 pt-5 sm:pt-7">
          <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <BuilderAvatar githubId={builder.githubId} login={builder.githubLogin} size={48} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-text-muted-2">builder workspace</p>
                <h1 className="mt-0.5 truncate text-xl font-medium sm:text-2xl">{builder.name ?? builder.githubLogin}</h1>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted-1 sm:text-sm">
                  <span>@{builder.githubLogin}</span>
                  {builder.installationId && <><span aria-hidden="true">·</span><IconGithub className="h-3.5 w-3.5" aria-hidden="true" /> tracking repos</>}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {builder.installationId && <a href={GITHUB_APP_INSTALL_URL} className="text-text-muted-1 hover:text-base-blue">manage repos</a>}
              {!builder.hidden && (
                <a
                  href={shareOnXHref(profileShareText({ login: builder.githubLogin, tier: tierFor(builder.score).tier.name, score: builder.score, weekRank: null, streak: builder.currentStreak }))}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-void px-3.5 py-2 text-xs font-medium text-white transition hover:opacity-85"
                >
                  <IconX className="h-3.5 w-3.5" aria-hidden="true" /> share profile
                </a>
              )}
              <Link href={`/@${builder.githubLogin}`} className="inline-flex items-center gap-1 text-text-muted-1 hover:text-base-blue">
                public profile <IconArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link href="/api/auth/logout" prefetch={false} className="inline-flex items-center gap-1 text-text-muted-1 hover:text-base-blue">
                <IconLogout className="h-3.5 w-3.5" aria-hidden="true" /> log out
              </Link>
            </div>
          </header>

          {!builder.installationId && <InstallAppPrompt installUrl={GITHUB_APP_INSTALL_URL} />}
          {!builder.installationId && (
            <div className="flex flex-col gap-4 rounded-lg border border-base-blue bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-tint"><IconNode className="h-4 w-4 text-base-blue" aria-hidden="true" /></span>
                <div>
                  <p className="font-medium">one more step: install the GitHub App</p>
                  <p className="mt-1 text-sm text-text-muted-1">pick the repos outship should watch. pushes and merged PRs on the default branch, and published releases, become ships.</p>
                </div>
              </div>
              <a href={GITHUB_APP_INSTALL_URL} className="inline-flex shrink-0 items-center justify-center gap-2.5 rounded-md border border-base-blue bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
                <IconGithub className="h-4 w-4" aria-hidden="true" /> install on github
              </a>
            </div>
          )}

          <div className="grid min-w-0 gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-8">
            <ProfileSidebar />
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}
