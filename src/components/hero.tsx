import Link from "next/link";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { IconSeal, IconStreak } from "@/components/icons";

// The art is drawn by scripts/draw-tower.mjs: the outship tower as an
// engraving, bleeding off the left edge, with a ruined arcade along the
// bottom. On landscape screens (the `wide` variant in globals.css) it sits
// behind the centred copy, anchored bottom left, and the nav floats over the
// top (SiteShell navOverlay); a soft cream glow keeps the copy readable where
// it passes over the tower's lines, and the hero is at least 46rem tall so
// the arcade stays below the buttons on short laptops. Portrait screens put
// the art under the copy. The dot grid is the page's own background, so the art needs none.
const WIDE_MEDIA = "(min-width: 900px) and (min-aspect-ratio: 4/3)";

const ART = {
  wide: { src: "/scene/tower-wide.svg", width: 1660, height: 1060 },
  tall: { src: "/scene/tower-tall.svg", width: 940, height: 920 },
};

export function Hero() {
  return (
    <section className="relative isolate overflow-clip bg-cream bg-[radial-gradient(circle,var(--color-text-muted-3)_1px,transparent_1.2px)] bg-size-[22px_22px] wide:min-h-[max(100svh,46rem)]">
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 pt-28 text-center sm:gap-6 sm:pt-32 short:gap-4 short:pt-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-16 inset-y-10 -z-10 bg-[radial-gradient(ellipse_at_center,var(--color-cream)_55%,transparent_75%)]"
        />
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-tint px-4 py-1.5 text-xs font-medium text-base-blue">
          <IconSeal className="h-3.5 w-3.5" />
          verified onchain · base
        </span>

        <h1 className="text-3xl font-medium leading-tight sm:text-5xl xl:text-6xl short:max-xl:text-4xl">
          everyone says they ship.
          <br />
          now you can <span className="text-base-blue">prove it.</span>
        </h1>

        <p className="max-w-xl text-base text-text-muted-1 sm:text-lg">
          github-verified commits, releases, and streaks — attested onchain
          so the receipts are yours, not ours.
        </p>

        <p className="text-sm text-text-muted-2">
          + shipping&nbsp;&nbsp;+ ranking&nbsp;&nbsp;+ bragging
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <ConnectGithubButton variant="dark" />
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center gap-2.5 rounded-md border border-void bg-white px-6 py-3 text-sm font-medium transition hover:bg-void hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-void"
          >
            <IconStreak className="h-5 w-5 shrink-0" aria-hidden="true" />
            see the leaderboard
          </Link>
        </div>
      </div>

      <picture>
        <source media={WIDE_MEDIA} srcSet={ART.wide.src} width={ART.wide.width} height={ART.wide.height} />
        <img
          src={ART.tall.src}
          width={ART.tall.width}
          height={ART.tall.height}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="mt-6 block h-auto w-full select-none wide:absolute wide:inset-0 wide:mt-0 wide:h-full wide:object-cover wide:object-left-bottom"
        />
      </picture>
    </section>
  );
}
