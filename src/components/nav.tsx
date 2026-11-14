import Link from "next/link";
import { LogoMark } from "@/components/icons";
import { NavMenu, type NavLink } from "@/components/nav-menu";
import { AccountNavLink } from "@/components/account-nav-link";

const LINKS: NavLink[] = [
  { href: "/leaderboard", label: "leaderboard" },
  { href: "/builders", label: "index" },
  { href: "/streaks", label: "streaks" },
];

export function Nav() {
  return (
    <header className="relative border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-6 w-6 text-void" />
          <span className="text-lg font-medium">outship</span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          <span className="hidden text-text-muted-1 sm:inline">
            v0.1 · always shipping
          </span>

          <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
            {LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-base-blue">
                {label}
              </Link>
            ))}
            <AccountNavLink className="hover:text-base-blue" />
          </nav>

          <NavMenu links={LINKS} />
        </div>
      </div>
    </header>
  );
}
