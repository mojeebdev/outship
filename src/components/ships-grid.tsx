import Link from "next/link";
import { IconArrowUpRight } from "@/components/icons";
import { MERGE_POINTS, PUSH_POINTS, RELEASE_POINTS, REVIEWED_MERGE_POINTS, STREAK_CAP, STREAK_POINTS_PER_DAY } from "@/lib/score";

// S·H·I·P·S: each letter is a door into the part of outship it names. The
// detail lines are real rules, not marketing: the numbers come from
// src/lib/score.ts so they can't drift from the scoring.
const shipsItems = [
  {
    letter: "S",
    label: "Streaks",
    description: "stay active daily",
    detail: "one more day, every UTC day you ship",
    href: "/streaks",
  },
  {
    letter: "H",
    label: "Highlights",
    description: "share your week",
    detail: "the weekly ship recap, every monday",
    href: "#recap",
  },
  {
    letter: "I",
    label: "Index",
    description: "browse builders",
    detail: "every builder on outship, a to z",
    href: "/builders",
  },
  {
    letter: "P",
    label: "Profile",
    description: "github, ranked",
    detail: "your public page at /@handle",
    href: "/profile",
  },
  {
    letter: "S",
    label: "Score",
    description: "quality + cadence",
    detail: `release up to ${RELEASE_POINTS} · PR ${MERGE_POINTS}–${REVIEWED_MERGE_POINTS} · push ${PUSH_POINTS} · streak ${STREAK_POINTS_PER_DAY}/day up to ${STREAK_CAP} days`,
    href: "/faq#scoring",
  },
];

export function ShipsGrid() {
  return (
    <section aria-labelledby="ships-heading" className="border-y border-border px-6 py-16 sm:py-20">
      <h2 id="ships-heading" className="sr-only">
        what outship does
      </h2>
      <ol className="mx-auto grid max-w-6xl overflow-clip rounded-lg border border-border bg-white lg:grid-cols-5">
        {shipsItems.map(({ letter, label, description, detail, href }, index) => (
          <li
            key={`${label}-${index}`}
            className="border-border not-last:border-b lg:not-last:border-r lg:not-last:border-b-0"
          >
            <Link
              href={href}
              className="group flex h-full items-center gap-5 px-5 py-5 transition-colors duration-200 hover:bg-base-blue focus-visible:bg-base-blue focus-visible:outline-none sm:gap-8 sm:px-8 lg:flex-col lg:items-start lg:gap-10 lg:px-6 lg:py-8"
            >
              <span
                aria-hidden="true"
                className="w-12 shrink-0 text-6xl leading-none font-medium tracking-tight text-base-blue transition-colors duration-200 group-hover:text-white group-focus-visible:text-white sm:w-16 sm:text-7xl lg:w-auto lg:text-8xl"
              >
                {letter}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1 lg:w-full">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium transition-colors duration-200 group-hover:text-white group-focus-visible:text-white">
                    {label}
                  </span>
                  <IconArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-text-muted-2 transition duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white group-focus-visible:text-white motion-reduce:transform-none"
                  />
                </span>
                <span className="text-sm text-text-muted-1 transition-colors duration-200 group-hover:text-white/80 group-focus-visible:text-white/80">
                  {description}
                </span>
                <span className="mt-2 border-t border-border pt-2 text-xs text-text-muted-2 transition-colors duration-200 group-hover:border-white/25 group-hover:text-white/70 group-focus-visible:border-white/25 group-focus-visible:text-white/70 lg:mt-4 lg:pt-3">
                  {detail}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
