import Link from "next/link";
import { IconGithub, LogoMark } from "@/components/icons";
import { NavMenu, type NavLink } from "@/components/nav-menu";
import { AccountNavLink } from "@/components/account-nav-link";
import { OUTSHIP_VERSION } from "@/lib/version";

const LINKS: NavLink[] = [
  { href: "/leaderboard", label: "leaderboard" },
  { href: "/builders", label: "index" },
  { href: "/streaks", label: "streaks" },
];

// White pills that float over whatever is behind them: the status on the
// left, the logo and links in the middle, the account on the right. Over the
// home page's blue hero they sit in the sky (overlay), elsewhere on the cream
// page above the content.
// Display is left to each pill, so `hidden` can switch one off on small screens.
const PILL = "items-center rounded-full border border-border bg-white shadow-sm";

export function Nav({ overlay = false }: { overlay?: boolean }) {
  return (
    <header className={overlay ? "absolute inset-x-0 top-0 z-20" : "relative z-20"}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <span className={`${PILL} hidden gap-2 justify-self-start px-4 py-2 text-xs text-text-muted-1 lg:inline-flex`}>
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-base-blue ring-4 ring-blue-tint" />
          v{OUTSHIP_VERSION} · always shipping
        </span>

        <nav aria-label="Main" className={`${PILL} inline-flex gap-1 py-1 pl-1 pr-4 text-sm font-medium lg:gap-6 lg:pr-5`}>
          <Link href="/" className="flex items-center gap-2 rounded-full pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-blue">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-void text-white">
              <LogoMark className="h-4 w-4" />
            </span>
            <span className="lg:sr-only">outship</span>
          </Link>
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hidden hover:text-base-blue lg:inline">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <span className="hidden lg:inline-flex">
            <AccountNavLink className={`${PILL} inline-flex gap-2 px-4 py-2 text-sm font-medium transition hover:border-base-blue hover:text-base-blue`} icon={<IconGithub className="h-4 w-4" aria-hidden="true" />} />
          </span>
          <NavMenu links={LINKS} />
        </div>
      </div>
    </header>
  );
}
