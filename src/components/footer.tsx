import Link from "next/link";
import {
  IconGithub,
  IconNode,
  IconSeal,
  IconShip,
  IconStreak,
  IconX,
  LogoMark,
} from "@/components/icons";
import { EmailCaptureForm } from "@/components/email-capture-form";

const strip = [
  { Icon: IconNode, size: 16 },
  { Icon: IconShip, size: 20 },
  { Icon: IconStreak, size: 24 },
  { Icon: IconSeal, size: 28 },
  { Icon: IconNode, size: 32 },
  { Icon: IconShip, size: 36 },
  { Icon: IconStreak, size: 40 },
  { Icon: IconSeal, size: 44 },
];

const columns: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "info",
    links: [
      { label: "about", href: "/about" },
      { label: "manifesto", href: "/manifesto" },
      { label: "changelog", href: "/changelog" },
      { label: "contact", href: "/contact" },
    ],
  },
  {
    heading: "product",
    links: [
      { label: "leaderboard", href: "/leaderboard" },
      { label: "index", href: "/builders" },
      { label: "streaks", href: "/streaks" },
      { label: "profile", href: "/profile" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-void text-white">
      <div className="mx-auto flex max-w-6xl items-end gap-3 overflow-hidden px-6 pt-10">
        {strip.map(({ Icon, size }, index) => (
          <Icon
            key={index}
            style={{ width: size, height: size }}
            className={index % 2 === 0 ? "text-white/15" : "text-base-blue/50"}
          />
        ))}
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 border-b border-white/10 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="text-lg font-medium">outship</span>
          </div>
          <p className="text-sm text-white/60">
            ideas are free. shipping isn&apos;t.
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3 sm:items-end">
          <span className="text-sm text-white/60 sm:text-right">
            get the weekly ship recap
          </span>
          <EmailCaptureForm />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 border-b border-white/10 px-6 py-12 sm:grid-cols-3">
        {columns.map(({ heading, links }) => (
          <div key={heading} className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-wide text-white/40">
              {heading}
            </span>
            {links.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-sm text-white/80 hover:text-base-blue"
              >
                {label}
              </Link>
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-wide text-white/40">
            social
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/mojeebdev/outship"
              target="_blank"
              rel="noreferrer"
              aria-label="outship on GitHub"
              className="text-white/80 hover:text-base-blue"
            >
              <IconGithub className="h-5 w-5" />
            </a>
            <a
              href="https://x.com/outshipdev"
              target="_blank"
              rel="noreferrer"
              aria-label="outship on X"
              className="text-white/80 hover:text-base-blue"
            >
              <IconX className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 border-b border-white/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-xs font-medium text-white">
            BL
          </span>
          a blindspotlab product
        </div>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <span className="h-3 w-3 rounded-full bg-base-blue" />
          powered by base
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 BlindspotLab Limited</span>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-white/70">
            terms
          </Link>
          <Link href="/privacy" className="hover:text-white/70">
            privacy
          </Link>
          <span>made in lagos</span>
        </div>
      </div>
    </footer>
  );
}
