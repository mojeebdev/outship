import Link from "next/link";
import { IconGithub, IconX, LogoMark } from "@/components/icons";
import { EmailCaptureForm } from "@/components/email-capture-form";
import { AccountNavLink } from "@/components/account-nav-link";
import { PrivacyChoicesLink } from "@/components/privacy-choices-link";

type FooterLink = {
  label: string;
  href: string;
  /** A different hostname, so it needs a plain anchor rather than next/link. */
  external?: boolean;
};

const columns: Array<{ heading: string; links: FooterLink[]; account?: boolean }> = [
  {
    heading: "product",
    links: [
      { label: "leaderboard", href: "/leaderboard" },
      { label: "index", href: "/builders" },
      { label: "streaks", href: "/streaks" },
      { label: "stats", href: "/stats" },
      { label: "API", href: "/developers" },
    ],
    account: true,
  },
  {
    heading: "outship",
    links: [
      { label: "about", href: "/about" },
      { label: "manifesto", href: "/manifesto" },
      { label: "changelog", href: "/changelog" },
      { label: "faq", href: "/faq" },
      { label: "token", href: "/token" },
    ],
  },
  {
    heading: "more",
    links: [
      { label: "word counter", href: "https://word.outship.dev", external: true },
      { label: "contact", href: "/contact" },
      { label: "terms", href: "/terms" },
      { label: "privacy", href: "/privacy" },
    ],
  },
];

const LINK = "text-sm text-white/70 transition hover:text-white";
const CREDIT = "flex w-fit items-center gap-2 text-xs text-white/65 transition hover:text-white";

// The closing scene: Base blue, light type, and a two-colour print of the
// arcade and the tower along the bottom (public/scene/tower-print.svg, from
// scripts/draw-tower.mjs), like a linocut.
export function Footer() {
  return (
    <footer className="overflow-clip bg-base-blue text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 pt-16 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
        <div className="flex flex-col gap-5">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-2xl font-medium">outship</span>
          </Link>
          <p className="text-sm leading-relaxed text-white/75">
            ideas are free. shipping isn&apos;t. outship turns what you ship into
            a record you own: verified by github, attested on base.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/mojeebdev/outship" target="_blank" rel="noreferrer" aria-label="outship on GitHub" className="text-white/75 transition hover:text-white">
              <IconGithub className="h-5 w-5" />
            </a>
            <a href="https://x.com/outshipdev" target="_blank" rel="noreferrer" aria-label="outship on X" className="text-white/75 transition hover:text-white">
              <IconX className="h-5 w-5" />
            </a>
          </div>
          <div id="recap" className="mt-2 flex scroll-mt-24 flex-col gap-3">
            <span className="text-sm font-medium">the weekly ship recap, every monday</span>
            <EmailCaptureForm />
          </div>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-3 gap-6 sm:gap-8 lg:justify-items-end">
          {columns.map(({ heading, links, account }) => (
            <div key={heading} className="flex flex-col gap-3">
              <span className="text-sm font-medium">{heading}</span>
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
              {account && <AccountNavLink className={LINK} />}
            </div>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-3 px-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
        <a href="https://blindspotlab.xyz" target="_blank" rel="noreferrer" className={CREDIT}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG; next/image adds nothing here */}
          <img src="/brand/blindspotlab-mark.svg" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-[3px]" />
          a blindspotlab product
        </a>
        <a href="https://x.com/MojeebMotion" target="_blank" rel="noreferrer" className={CREDIT}>
          <IconX className="h-3.5 w-3.5" aria-hidden="true" />
          built by mojeeb (@MojeebMotion)
        </a>
        <a href="https://base.org" target="_blank" rel="noreferrer" className={CREDIT}>
          {/* The Base square in its white version: blue would vanish on Base blue. */}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
            <rect width="24" height="24" rx="2.5" fill="#ffffff" />
          </svg>
          powered by base
        </a>
        <PrivacyChoicesLink className="w-fit text-left text-xs text-white/65 underline decoration-white/30 underline-offset-2 transition hover:text-white" />
        <span className="text-xs text-white/50 sm:ml-auto">
          © 2026 BlindspotLab Limited · made in lagos
        </span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG drawing; next/image would only pass it through */}
      <img
        src="/scene/tower-print.svg"
        width={1640}
        height={580}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="mt-6 block h-auto w-full select-none"
      />
    </footer>
  );
}
