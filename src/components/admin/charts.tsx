// Charts for the admin panel, /stats and the builder's own /profile: plain
// SVG rendered on the server, in outship's own colours. No chart library, no client JavaScript; every number is also
// in the markup (titles and labels), so it reads without hovering.
import type { Bucket, Cohort, Ranked } from "@/lib/metrics";

const nf = new Intl.NumberFormat("en-US");
export const fmt = (value: number) => nf.format(Math.round(value));

export function DeltaBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-xs text-text-muted-2">new</span>;
  const up = value > 0;
  const good = inverse ? !up : up;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        flat ? "text-text-muted-2" : good ? "text-base-blue" : "text-[#c2410c]"
      }`}
    >
      {flat ? "→" : up ? "↑" : "↓"} {Math.abs(Math.round(value * 100))}%
    </span>
  );
}

/** A tiny bar series for a KPI card. */
export function Spark({ values, dark = false }: { values: number[]; dark?: boolean }) {
  const max = Math.max(1, ...values);
  const width = 96;
  const height = 32;
  const step = width / Math.max(1, values.length);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      {values.map((value, i) => {
        const h = Math.max(2, (value / max) * height);
        return (
          <rect
            key={i}
            x={i * step + step * 0.15}
            y={height - h}
            width={step * 0.7}
            height={h}
            rx={1}
            style={{ fill: dark ? "rgba(255,255,255,0.55)" : "var(--color-base-blue)", opacity: i === values.length - 1 ? 1 : 0.55 }}
          />
        );
      })}
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  previous,
  deltaValue,
  spark,
  note,
  highlight = false,
}: {
  label: string;
  value: string;
  previous?: string;
  deltaValue?: number | null;
  spark?: number[];
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 ${
        highlight ? "border-void bg-void text-white" : "border-border bg-white"
      }`}
    >
      <span className={`text-sm ${highlight ? "text-white/70" : "text-text-muted-1"}`}>{label}</span>
      <div className="flex items-end justify-between gap-3">
        <span className="text-3xl font-medium tracking-tight">{value}</span>
        {spark && spark.length > 1 && <Spark values={spark} dark={highlight} />}
      </div>
      <div className={`flex flex-wrap items-center gap-x-2 text-xs ${highlight ? "text-white/60" : "text-text-muted-2"}`}>
        {deltaValue !== undefined && <DeltaBadge value={deltaValue} />}
        {previous !== undefined && <span>vs {previous} the period before</span>}
        {note && <span>{note}</span>}
      </div>
    </div>
  );
}

function bucketLabel(date: Date, bucketMs: number): string {
  if (bucketMs < 86_400_000) {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A bar chart over time with the busiest bucket called out. */
export function BarSeries({ title, buckets, bucketMs, unit }: { title: string; buckets: Bucket[]; bucketMs: number; unit: string }) {
  const width = 720;
  const height = 180;
  const pad = { top: 24, right: 8, bottom: 22, left: 36 };
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  const peakIndex = buckets.reduce((best, bucket, i) => (bucket.value > buckets[best].value ? i : best), 0);
  const step = (width - pad.left - pad.right) / Math.max(1, buckets.length);
  const y = (value: number) => pad.top + (height - pad.top - pad.bottom) * (1 - value / max);
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const ticks = [0, Math.ceil(max / 2), max];
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-white p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-text-muted-1">
          {fmt(total)} {unit}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${title}: ${fmt(total)} ${unit}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} style={{ stroke: "var(--color-border)" }} strokeDasharray={tick === 0 ? undefined : "3 4"} />
            <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" fontSize="10" style={{ fill: "var(--color-text-muted-2)" }}>
              {fmt(tick)}
            </text>
          </g>
        ))}
        {buckets.map((bucket, i) => {
          const top = y(bucket.value);
          const isPeak = i === peakIndex && bucket.value > 0;
          return (
            <g key={i}>
              <rect
                x={pad.left + i * step + step * 0.12}
                y={top}
                width={step * 0.76}
                height={Math.max(0, height - pad.bottom - top)}
                rx={Math.min(4, step * 0.3)}
                style={{ fill: isPeak ? "var(--color-base-blue)" : "color-mix(in srgb, var(--color-base-blue) 35%, white)" }}
              >
                <title>{`${bucketLabel(bucket.start, bucketMs)}: ${fmt(bucket.value)} ${unit}`}</title>
              </rect>
              {isPeak && (
                <text x={pad.left + i * step + step / 2} y={top - 6} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: "var(--color-void)" }}>
                  {fmt(bucket.value)}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text x={pad.left + i * step + step / 2} y={height - 6} textAnchor="middle" fontSize="10" style={{ fill: "var(--color-text-muted-2)" }}>
                  {bucketLabel(bucket.start, bucketMs)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Horizontal bars for a ranked list (languages, repos, pages, countries). */
export function RankedBars({ title, rows, empty = "nothing yet" }: { title: string; rows: Ranked[]; empty?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-white p-5">
      <h3 className="font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted-2">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1">
              <span className="flex justify-between gap-2 text-sm">
                <span className="truncate">{row.label}</span>
                <span className="shrink-0 text-text-muted-1">{fmt(row.value)}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-blue-tint">
                <span className="block h-full rounded-full bg-base-blue" style={{ width: `${(row.value / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** A progress ring, for a single rate. */
export function Ring({ title, value, label, detail }: { title: string; value: number; label: string; detail: string }) {
  const radius = 52;
  const circumference = Math.PI * radius; // a half ring
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <section className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-white p-5 text-center">
      <h3 className="self-start font-medium">{title}</h3>
      <svg viewBox="0 0 140 84" className="w-48" role="img" aria-label={`${title}: ${Math.round(clamped * 100)}%`}>
        <path d="M 18 74 A 52 52 0 0 1 122 74" fill="none" strokeWidth="14" strokeLinecap="round" style={{ stroke: "var(--color-blue-tint)" }} />
        <path
          d="M 18 74 A 52 52 0 0 1 122 74"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          style={{ stroke: "var(--color-base-blue)" }}
        />
        <text x="70" y="70" textAnchor="middle" fontSize="24" fontWeight="600" style={{ fill: "var(--color-void)" }}>
          {Math.round(clamped * 100)}%
        </text>
      </svg>
      <p className="text-sm">{label}</p>
      <p className="text-xs text-text-muted-2">{detail}</p>
    </section>
  );
}

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Ships by UTC weekday and hour. */
export function WeekHourHeatmap({ grid, title = "when people ship" }: { grid: number[][]; title?: string }) {
  const max = Math.max(1, ...grid.flat());
  const cell = 22;
  const left = 34;
  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-white p-5">
      <figcaption className="font-medium">{title} <span className="text-sm font-normal text-text-muted-2">· UTC hour by weekday</span></figcaption>
      <div className="overflow-x-auto">
        <svg width={left + 24 * cell} height={7 * cell + 18} role="img" aria-label="ships by UTC hour and weekday">
          {grid.map((row, d) =>
            row.map((value, h) => (
              <rect
                key={`${d}-${h}`}
                x={left + h * cell + 1}
                y={d * cell + 1}
                width={cell - 2}
                height={cell - 2}
                rx={3}
                style={{
                  fill: value === 0 ? "var(--color-border)" : `color-mix(in srgb, var(--color-base-blue) ${Math.round(20 + (value / max) * 80)}%, white)`,
                }}
              >
                <title>{`${DAYS[d]} ${String(h).padStart(2, "0")}:00 UTC: ${fmt(value)} ships`}</title>
              </rect>
            )),
          )}
          {DAYS.map((day, d) => (
            <text key={day} x={0} y={d * cell + 15} fontSize="10" style={{ fill: "var(--color-text-muted-2)" }}>
              {day}
            </text>
          ))}
          {[0, 6, 12, 18, 23].map((h) => (
            <text key={h} x={left + h * cell + cell / 2} y={7 * cell + 14} textAnchor="middle" fontSize="10" style={{ fill: "var(--color-text-muted-2)" }}>
              {String(h).padStart(2, "0")}
            </text>
          ))}
        </svg>
      </div>
    </figure>
  );
}

/** Weekly retention, as a classic cohort triangle. */
export function CohortTable({ cohorts }: { cohorts: Cohort[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-white p-5">
      <h3 className="font-medium">
        retention <span className="text-sm font-normal text-text-muted-2">· of builders who signed in that week, the share shipping N weeks later</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="text-text-muted-2">
              <th className="text-left font-normal">week of</th>
              <th className="text-right font-normal">builders</th>
              {cohorts[0]?.retained.map((_, i) => (
                <th key={i} className="font-normal">
                  {i === 0 ? "same" : `+${i}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.week.toISOString()}>
                <td className="whitespace-nowrap text-left text-text-muted-1">
                  {cohort.week.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                </td>
                <td className="text-right">{cohort.size}</td>
                {cohort.retained.map((rate, i) => (
                  <td
                    key={i}
                    className="min-w-10 rounded px-1 py-1.5 text-center"
                    style={
                      rate === null || cohort.size === 0
                        ? { background: "transparent" }
                        : { background: `color-mix(in srgb, var(--color-base-blue) ${Math.round(8 + rate * 80)}%, white)`, color: rate > 0.55 ? "white" : undefined }
                    }
                  >
                    {rate === null || cohort.size === 0 ? "" : `${Math.round(rate * 100)}%`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * A share of a whole as a donut, with the legend beside it: each slice's
 * count and percentage, so it reads without hovering. Shades of the blue,
 * darkest first.
 */
export function Donut({ title, rows, unit }: { title: string; rows: Ranked[]; unit: string }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const shades = ["var(--color-base-blue)", "color-mix(in srgb, var(--color-base-blue) 55%, white)", "color-mix(in srgb, var(--color-base-blue) 22%, white)"];
  const r = 52;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <figure className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-white p-5">
      <figcaption className="font-medium">{title}</figcaption>
      <div className="flex flex-wrap items-center gap-6">
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`${title}: ${fmt(total)} ${unit}`} className="shrink-0">
          <circle cx="70" cy="70" r={r} fill="none" strokeWidth="18" style={{ stroke: "var(--color-border)" }} />
          {total > 0 &&
            rows.map((row, i) => {
              const length = (row.value / total) * circumference;
              const slice = (
                <circle
                  key={row.label}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  strokeWidth="18"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                  style={{ stroke: shades[i % shades.length] }}
                />
              );
              offset += length;
              return slice;
            })}
          <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="500" style={{ fill: "var(--color-void)" }}>
            {fmt(total)}
          </text>
          <text x="70" y="86" textAnchor="middle" fontSize="11" style={{ fill: "var(--color-text-muted-2)" }}>
            {unit}
          </text>
        </svg>
        <ul className="flex min-w-40 flex-1 flex-col gap-2.5 text-sm">
          {rows.map((row, i) => (
            <li key={row.label} className="flex items-center gap-3">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: shades[i % shades.length] }} />
              <span className="flex-1">{row.label}</span>
              <span className="tabular-nums text-text-muted-1">{fmt(row.value)}</span>
              <span className="w-10 text-right tabular-nums text-text-muted-2">
                {total > 0 ? `${Math.round((row.value / total) * 100)}%` : "–"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
