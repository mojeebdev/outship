import Link from "next/link";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { IconSeal, IconStreak } from "@/components/icons";

// The scene is drawn by scripts/draw-climb.mjs in three crops. On landscape
// screens (the `wide` variant in globals.css) it fills the hero and the copy
// sits in the sky beside the tower; portrait screens can't fit both side by
// side, so the scene follows the copy. The section's blue is the scene's sky,
// so the two meet without a seam.
//
// In the wide layout the copy is kept smaller until xl so it ends before the
// tower, and the section is at least 48vw tall so very wide, short windows
// don't crop the top of the tower.
const WIDE_MEDIA = "(min-width: 900px) and (min-aspect-ratio: 4/3)";

const SCENE = {
  wide: { src: "/scene/climb-wide.svg", width: 2030, height: 1000 },
  mid: { src: "/scene/climb-mid.svg", width: 1320, height: 970 },
  tall: { src: "/scene/climb-tall.svg", width: 900, height: 940 },
};

export function Hero() {
  return (
    <section className="relative isolate bg-base-blue text-white wide:min-h-[max(calc(100svh-4rem),37.5rem,48vw)]">
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-10 sm:pt-16 wide:pt-12">
        <div className="flex max-w-3xl flex-col items-start gap-4 sm:gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-4 py-1.5 text-xs font-medium">
            <IconSeal className="h-3.5 w-3.5" />
            verified onchain · base
          </span>

          <h1 className="text-3xl font-medium leading-tight sm:text-6xl wide:text-4xl wide:xl:text-6xl">
            everyone says they ship.
            <br />
            now you can{" "}
            <span className="rounded-[0.12em] bg-white box-decoration-clone px-[0.18em] text-base-blue">
              prove it.
            </span>
          </h1>

          <p className="max-w-xl text-base text-white/85 sm:text-lg wide:max-w-md wide:xl:max-w-xl">
            github-verified commits, releases, and streaks — attested onchain
            so the receipts are yours, not ours.
          </p>

          <p className="text-sm text-white/80">
            + shipping&nbsp;&nbsp;+ ranking&nbsp;&nbsp;+ bragging
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <ConnectGithubButton variant="inverse" />
            <Link
              href="/leaderboard"
              className="inline-flex items-center justify-center gap-2.5 rounded-md border border-white px-6 py-3 text-sm font-medium transition hover:bg-white hover:text-base-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <IconStreak className="h-5 w-5 shrink-0" aria-hidden="true" />
              see the leaderboard
            </Link>
          </div>
        </div>
      </div>

      <picture>
        <source media={WIDE_MEDIA} srcSet={SCENE.wide.src} width={SCENE.wide.width} height={SCENE.wide.height} />
        <source media="(min-width: 640px)" srcSet={SCENE.mid.src} width={SCENE.mid.width} height={SCENE.mid.height} />
        <img
          src={SCENE.tall.src}
          width={SCENE.tall.width}
          height={SCENE.tall.height}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="mt-8 block h-auto w-full select-none wide:absolute wide:inset-0 wide:mt-0 wide:h-full wide:object-cover wide:object-right-bottom"
        />
      </picture>
    </section>
  );
}
