import Link from "next/link";
import { IconGithub, IconX, LogoMark } from "@/components/icons";
import { EmailCaptureForm } from "@/components/email-capture-form";
import { AccountNavLink } from "@/components/account-nav-link";
import { isTokenLive } from "@/lib/token";

type FooterLink = {
  label: string;
  href: string;
  /** A different hostname, so it needs a plain anchor rather than next/link. */
  external?: boolean;
};

const columns: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: "info",
    links: [
      { label: "about", href: "/about" },
      { label: "manifesto", href: "/manifesto" },
      { label: "changelog", href: "/changelog" },
      { label: "faq", href: "/faq" },
      { label: "contact", href: "/contact" },
      // Only once the token exists: NEXT_PUBLIC_TOKEN_ADDRESS is set at build.
      ...(isTokenLive() ? [{ label: "token", href: "/token" }] : []),
    ],
  },
  {
    heading: "product",
    links: [
      { label: "leaderboard", href: "/leaderboard" },
      { label: "index", href: "/builders" },
      { label: "streaks", href: "/streaks" },
      { label: "word counter", href: "https://word.outship.dev", external: true },
      { label: "API", href: "/developers" },
      { label: "stats", href: "/stats" },
    ],
  },
];

const PILL = "flex w-fit items-center gap-2.5 rounded-full border border-border bg-white px-4 py-2 text-sm text-text-muted-1 shadow-sm transition hover:border-void hover:text-void";
const LINK = "text-sm text-text-muted-1 transition hover:text-base-blue";

// The page's closing scene, in the hero's language: cream with the dot grid,
// the tagline large and centred, the recap and links on white cards and
// pills like the nav, and the hero's engraved arcade along the bottom
// (public/scene/tower-arcade.svg, from scripts/draw-tower.mjs).
export function Footer() {
  return (
    <footer className="relative overflow-clip border-t border-border bg-cream bg-[radial-gradient(circle,var(--color-text-muted-3)_1px,transparent_1.2px)] bg-size-[22px_22px]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 pt-20 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-void text-white">
          <LogoMark className="h-6 w-6" />
        </span>
        <p className="text-3xl font-medium leading-tight sm:text-5xl">
          ideas are free.
          <br />
          <span className="text-base-blue">shipping isn&apos;t.</span>
        </p>

        <div
          id="recap"
          className="mt-4 flex w-full max-w-md scroll-mt-24 flex-col items-center gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm"
        >
          <span className="text-sm text-text-muted-1">get the weekly ship recap, every monday</span>
          <EmailCaptureForm />
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-2 gap-8 px-6 sm:grid-cols-3">
        {columns.map(({ heading, links }) => (
          <div key={heading} className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-wide text-text-muted-2">{heading}</span>
            {links.map(({ label, href, external }) =>
              external ? (
                <a key={label} href={href} className={LINK}>
                  {label}
                </a>
              ) : (
                <Link key={label} href={href} className={LINK}>
                  {label}
                </Link>
              ),
            )}
            {heading === "product" && <AccountNavLink className={LINK} />}
          </div>
        ))}

        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-text-muted-2">social</span>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/mojeebdev/outship"
              target="_blank"
              rel="noreferrer"
              aria-label="outship on GitHub"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white shadow-sm transition hover:border-void"
            >
              <IconGithub className="h-5 w-5" />
            </a>
            <a
              href="https://x.com/outshipdev"
              target="_blank"
              rel="noreferrer"
              aria-label="outship on X"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white shadow-sm transition hover:border-void"
            >
              <IconX className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-center gap-3 px-6">
        <a href="https://blindspotlab.xyz" target="_blank" rel="noreferrer" className={PILL}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG; next/image adds nothing here */}
          <img src="/brand/blindspotlab-mark.svg" alt="" width={20} height={20} className="h-5 w-5 rounded-[3px]" />
          a blindspotlab product
        </a>
        <a href="https://x.com/MojeebMotion" target="_blank" rel="noreferrer" className={PILL}>
          <IconX className="h-4 w-4" aria-hidden="true" />
          built by mojeeb (@MojeebMotion)
        </a>
        <a href="https://base.org" target="_blank" rel="noreferrer" className={PILL}>
          {/* The Base square, Base's logo. */}
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <rect width="24" height="24" rx="2.5" fill="#0000FF" />
          </svg>
          powered by base
        </a>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-text-muted-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          © 2026{" "}
          <a href="https://blindspotlab.xyz" target="_blank" rel="noreferrer" className="hover:text-void">
            BlindspotLab Limited
          </a>
        </span>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-void">
            terms
          </Link>
          <Link href="/privacy" className="hover:text-void">
            privacy
          </Link>
          <span>made in lagos</span>
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG drawing; next/image would only pass it through */}
      <img
        src="/scene/tower-arcade.svg"
        width={1280}
        height={300}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="block h-auto max-h-72 w-full select-none object-cover object-top"
      />
    </footer>
  );
}
