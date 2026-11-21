import type { ReactNode } from "react";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <SiteShell>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-text-muted-2">outship workspace</p><p className="mt-0.5 text-lg font-medium">admin</p></div>
          <p className="text-xs text-text-muted-2">private operations</p>
        </div>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
          <AdminNavigation />
          <div className="flex min-w-0 flex-col gap-5">{children}</div>
        </div>
      </div>
    </SiteShell>
  );
}
