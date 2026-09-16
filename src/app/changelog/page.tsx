import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { IconShip } from "@/components/icons";

export const metadata: Metadata = {
  title: "changelog — outship",
};

const entries = [
  {
    date: "sep 2026",
    title: "landing page is live",
    description:
      "the site is up: hero, featured ships, the SHIPS grid, the manifesto, and the footer. github connect and the leaderboard are next.",
  },
];

export default function ChangelogPage() {
  return (
    <SiteShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">changelog</h1>

        <ol className="flex flex-col gap-8">
          {entries.map(({ date, title, description }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-tint">
                <IconShip className="h-4 w-4 text-base-blue" />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted-2">{date}</span>
                <h2 className="font-medium">{title}</h2>
                <p className="text-sm text-text-muted-1">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </SiteShell>
  );
}
