"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArrowRight } from "@/components/icons";
import { PROFILE_LINK, SIGN_IN_LINK } from "@/components/account-nav-link";
import { useSignedIn } from "@/components/use-signed-in";

export type NavLink = { href: string; label: string };

// Hamburger + dropdown for mobile and tablet. From `lg` up the header shows
// the links inline instead, so this whole component is hidden there.
export function NavMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const signedIn = useSignedIn();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded border border-border transition hover:border-void"
      >
        <span
          className={`block h-px w-4 bg-void transition-transform ${
            open ? "translate-y-[2.5px] rotate-45" : ""
          }`}
        />
        <span
          className={`block h-px w-4 bg-void transition-transform ${
            open ? "-translate-y-[2.5px] -rotate-45" : ""
          }`}
        />
      </button>

      <nav
        id="site-menu"
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 border-b border-border bg-cream shadow-sm"
      >
        <ul className="mx-auto flex max-w-6xl flex-col px-6 py-2">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href} className="border-b border-border last:border-b-0">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between py-3.5 text-base transition hover:text-base-blue ${
                    active ? "font-medium text-base-blue" : ""
                  }`}
                >
                  {label}
                  <IconArrowRight className="h-4 w-4 text-text-muted-2" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
          {signedIn === true && (
            <li className="border-b border-border last:border-b-0">
              <Link
                href={PROFILE_LINK.href}
                aria-current={pathname === PROFILE_LINK.href ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between py-3.5 text-base transition hover:text-base-blue ${
                  pathname === PROFILE_LINK.href ? "font-medium text-base-blue" : ""
                }`}
              >
                {PROFILE_LINK.label}
                <IconArrowRight className="h-4 w-4 text-text-muted-2" aria-hidden="true" />
              </Link>
            </li>
          )}
          {signedIn === false && (
            <li className="border-b border-border last:border-b-0">
              <a
                href={SIGN_IN_LINK.href}
                className="flex items-center justify-between py-3.5 text-base transition hover:text-base-blue"
              >
                {SIGN_IN_LINK.label}
                <IconArrowRight className="h-4 w-4 text-text-muted-2" aria-hidden="true" />
              </a>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
