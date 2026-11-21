import Link from "next/link";
import { WINDOWS, type WindowKey } from "@/lib/metrics";

export function AdminPageHeader({ title, description, windowKey, section }: { title: string; description: string; windowKey: WindowKey; section: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-base-blue">admin / {section}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted-1">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="time window" className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 text-xs sm:text-sm">
          {(Object.keys(WINDOWS) as WindowKey[]).map((option) => (
            <Link key={option} href={`?w=${option}`} aria-current={option === windowKey ? "page" : undefined} className={`rounded-lg px-2.5 py-1.5 font-medium transition sm:px-3 ${option === windowKey ? "bg-base-blue text-white" : "text-text-muted-1 hover:text-base-blue"}`}>
              {option}
            </Link>
          ))}
        </nav>
        <a href={`/admin/export?w=${windowKey}`} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-medium transition hover:border-void sm:text-sm">export CSV</a>
      </div>
    </header>
  );
}
