import Link from "next/link";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { IconSeal, IconStreak } from "@/components/icons";

// The scene is drawn by scripts/draw-climb.mjs in three crops, each ending
// just right of the tower. On landscape screens (the `wide` variant in
// globals.css) it fills the hero, anchored bottom right, so the tower stands
// on the right and the centred copy sits in open sky; the copy is kept
// narrow enough to clear the tower, and the hero is at least 33rem tall so
// the buttons stay above the horizon. Portrait screens put the scene under
// the copy. The section's blue is the scene's sky, so they meet without a seam.
const WIDE_MEDIA = "(min-width: 900px) and (min-aspect-ratio: 4/3)";

const SCENE = {
  wide: { src: "/scene/climb-wide.svg", width: 2720, height: 970 },
  mid: { src: "/scene/climb-mid.svg", width: 1300, height: 970 },
  tall: { src: "/scene/climb-tall.svg", width: 900, height: 950 },
};

export function Hero() {
  return (
    <section className="relative isolate bg-base-blue text-white wide:min-h-[max(calc(100svh-4rem),33rem)]">
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 pt-10 text-center sm:gap-5 sm:pt-12 short:gap-3 short:pt-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-4 py-1.5 text-xs font-medium">
          <IconSeal className="h-3.5 w-3.5" />
          verified onchain · base
        </span>

        <h1 className="text-3xl font-medium leading-tight sm:text-5xl 2xl:text-6xl short:text-4xl">
          everyone says they ship.
          <br />
          now you can{" "}
          <span className="rounded-[0.12em] bg-white box-decoration-clone px-[0.18em] text-base-blue">
            prove it.
          </span>
        </h1>

        <p className="max-w-xl text-base text-white/85 sm:text-lg short:text-base wide:max-w-md xl:wide:max-w-xl">
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
          className="mt-4 block h-auto w-full select-none wide:absolute wide:inset-0 wide:mt-0 wide:h-full wide:object-cover wide:object-right-bottom"
        />
      </picture>
    </section>
  );
}
