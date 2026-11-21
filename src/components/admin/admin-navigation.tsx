"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { IconActivity, IconBuilders, IconGlobe, IconGrid, IconPlatform, type IconProps } from "@/components/icons";

const destinations: { href: string; label: string; detail: string; Icon: ComponentType<IconProps> }[] = [
  { href: "/admin", label: "Overview", detail: "Key signals", Icon: IconGrid },
  { href: "/admin/builders", label: "Builders", detail: "Growth and retention", Icon: IconBuilders },
  { href: "/admin/shipping", label: "Shipping", detail: "Ships and consistency", Icon: IconActivity },
  { href: "/admin/platform", label: "Platform", detail: "Installs and API", Icon: IconPlatform },
  { href: "/admin/traffic", label: "Traffic", detail: "Visits and reach", Icon: IconGlobe },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="admin" className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[.16em] text-text-muted-2 lg:block">operations</p>
      <ul className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-white p-2 sm:grid-cols-3 lg:grid-cols-1 lg:border-0 lg:bg-transparent lg:p-0">
        {destinations.map(({ href, label, detail, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-blue-tint font-medium text-base-blue" : "text-text-muted-1 hover:bg-cream hover:text-void"}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0"><span className="block">{label}</span><span className={`hidden text-[10px] font-normal sm:block ${active ? "text-base-blue/70" : "text-text-muted-2"}`}>{detail}</span></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
