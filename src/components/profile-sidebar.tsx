"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  IconActivity,
  IconAward,
  IconBuilders,
  IconGrid,
  IconNode,
  IconSettings,
  IconShip,
  type IconProps,
} from "@/components/icons";

const sections: { href: string; label: string; Icon: ComponentType<IconProps> }[] = [
  { href: "/profile", label: "overview", Icon: IconGrid },
  { href: "/profile/activity", label: "activity", Icon: IconActivity },
  { href: "/profile/shipmarks", label: "Shipmarks", Icon: IconAward },
  { href: "/profile/ships", label: "ship feed", Icon: IconShip },
  { href: "/profile/badge", label: "README badge", Icon: IconNode },
  { href: "/profile/community", label: "community", Icon: IconBuilders },
  { href: "/profile/settings", label: "settings", Icon: IconSettings },
];

export function ProfileSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="profile" className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-text-muted-2 lg:block">your workspace</p>
      <ul className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-white p-2 sm:grid-cols-4 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0">
        {sections.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-blue-tint font-medium text-base-blue"
                    : "text-text-muted-1 hover:bg-cream hover:text-void"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
