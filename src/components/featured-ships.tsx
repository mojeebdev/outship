import type { ComponentType } from "react";
import { IconSeal, IconShip, IconStreak, type IconProps } from "@/components/icons";

const featuredShips: Array<{
  tag: string;
  Icon: ComponentType<IconProps>;
  title: string;
  description: string;
  date: string;
}> = [
  {
    tag: "release",
    Icon: IconShip,
    title: "outship v0.1 is live",
    description: "the ship log opens for the first cohort.",
    date: "oct 2026",
  },
  {
    tag: "streak",
    Icon: IconStreak,
    title: "30-day club opens",
    description: "first builders to hit a streak get badged.",
    date: "nov 2026",
  },
  {
    tag: "onchain",
    Icon: IconSeal,
    title: "ship attestations land on base",
    description: "verify any ship onchain, free, forever.",
    date: "oct 2026",
  },
];

export function FeaturedShips() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-3">
        {featuredShips.map(({ tag, Icon, title, description, date }) => (
          <article
            key={title}
            className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-blue-tint px-3 py-1 text-xs font-medium text-base-blue">
                {tag}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded bg-cream">
                <Icon className="h-4 w-4 text-void" />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-text-muted-1">{description}</p>
            </div>
            <span className="text-xs text-text-muted-2">{date}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
