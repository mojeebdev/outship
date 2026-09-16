import Link from "next/link";
import { LogoMark } from "@/components/icons";

export function Nav() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="h-6 w-6 text-void" />
          <span className="text-lg font-medium">outship</span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          <span className="hidden text-text-muted-1 sm:inline">
            v0.1 · always shipping
          </span>
          <Link href="#leaderboard" className="hover:text-base-blue">
            leaderboard
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            className="flex h-8 w-8 flex-col items-center justify-center gap-1 rounded border border-border"
          >
            <span className="block h-px w-4 bg-void" />
            <span className="block h-px w-4 bg-void" />
          </button>
        </div>
      </div>
    </header>
  );
}
