import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";

// Loading states: the real nav and footer, with grey shapes where the page's
// data will land, laid out like the page itself so nothing jumps when it
// arrives. They pulse, unless the visitor asked for reduced motion.

/** One grey placeholder shape. Size it with className; `round` for an avatar. */
export function Bone({ className = "", round = false }: { className?: string; round?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-border/70 motion-reduce:animate-none ${round ? "rounded-full" : "rounded-md"} ${className}`}
    />
  );
}

/** A page's loading state: announced once to screen readers, drawn for everyone else. */
export function PageSkeleton({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <SiteShell>
      <div role="status" aria-busy="true" className={`mx-auto flex flex-col ${className}`}>
        <span className="sr-only">loading {label}…</span>
        {children}
      </div>
    </SiteShell>
  );
}

/** The h1 and its one-line description. */
export function HeadingSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Bone className={`h-9 ${wide ? "w-72" : "w-56"} max-w-full`} />
      <Bone className="h-4 w-96 max-w-full" />
    </div>
  );
}

/** A row of tabs or filter pills in a white bar. */
export function TabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-white p-1">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="flex flex-1 justify-center px-3 py-2">
          <Bone className="h-5 w-16" />
        </span>
      ))}
    </div>
  );
}

/** Ranked or listed builders: avatar, name, a number on the right. */
export function RowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ol className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-lg border border-border bg-white px-4 py-3">
          <Bone className="h-4 w-5" />
          <Bone className="h-8 w-8 shrink-0" round />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone className="h-4 w-32 max-w-full" />
            <Bone className="h-3 w-20" />
          </span>
          <Bone className="h-5 w-12" />
        </li>
      ))}
    </ol>
  );
}

/** Number cards, as on /stats, /admin and /profile. */
export function KpiSkeleton({ count = 4, className = "sm:grid-cols-2 lg:grid-cols-4" }: { count?: number; className?: string }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
          <Bone className="h-3 w-24" />
          <Bone className="h-8 w-20" />
          <Bone className="h-3 w-32 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** A chart card: title, then the plot area. */
export function ChartSkeleton({ height = "h-40" }: { height?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-5">
      <Bone className="h-4 w-40" />
      <Bone className={`${height} w-full`} />
    </div>
  );
}

/** A public profile below the nav: header, stats, heatmap, then the ship feed. */
export function ProfileBodySkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <span className="sr-only">loading profile…</span>
      <div className="flex items-center gap-4">
        <Bone className="h-16 w-16 shrink-0" round />
        <span className="flex flex-col gap-2">
          <Bone className="h-7 w-44" />
          <Bone className="h-4 w-28" />
        </span>
      </div>
      <KpiSkeleton className="grid-cols-2 sm:grid-cols-4" />
      <ChartSkeleton height="h-28" />
      <div className="flex flex-col gap-4">
        <Bone className="h-6 w-28" />
        <RowsSkeleton count={5} />
      </div>
    </div>
  );
}

/** The home page's "shipped just now" feed, while the latest ships load. */
export function FeedSkeleton() {
  return (
    <section role="status" aria-busy="true" className="px-6 py-16">
      <span className="sr-only">loading the latest ships…</span>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Bone className="h-8 w-52" />
          <Bone className="h-4 w-96 max-w-full" />
        </div>
        <ol className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 rounded-lg border border-border bg-white px-4 py-3">
              <Bone className="h-8 w-8 shrink-0" round />
              <Bone className="h-4 w-32 sm:w-56" />
              <Bone className="hidden h-4 flex-1 sm:block" />
              <Bone className="h-3 w-16" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
