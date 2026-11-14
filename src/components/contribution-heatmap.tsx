// A 53×7 contribution heatmap, rendered on the server as plain SVG: no client
// JavaScript, and each cell's <title> gives the exact count on hover.
import { heatmapCells, HEATMAP_WEEKS } from "@/lib/history";

// Base blue in four steps; empty days use the border tone.
const LEVEL_FILL = [
  "var(--color-border)",
  "color-mix(in srgb, var(--color-base-blue) 25%, white)",
  "color-mix(in srgb, var(--color-base-blue) 50%, white)",
  "color-mix(in srgb, var(--color-base-blue) 75%, white)",
  "var(--color-base-blue)",
] as const;

const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;

export function ContributionHeatmap({
  counts,
  unit,
  label,
  now = new Date(),
}: {
  /** "YYYY-MM-DD" → count. */
  counts: Map<string, number>;
  /** What a cell counts, singular: "contribution" or "verified ship". */
  unit: string;
  /** The caption, e.g. "github history · not part of score". */
  label: string;
  now?: Date;
}) {
  const cells = heatmapCells(counts, now);
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  const width = HEATMAP_WEEKS * STEP - GAP;
  const height = 7 * STEP - GAP;
  const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`;

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-border bg-white p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`${plural(total)} in the last year`}
          className="block max-w-none"
        >
          {cells.map((cell) => (
            <rect
              key={cell.date}
              x={cell.week * STEP}
              y={cell.weekday * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              // style, not the fill attribute: var() and color-mix() only
              // resolve reliably as CSS.
              style={{ fill: LEVEL_FILL[cell.level] }}
            >
              <title>{`${plural(cell.count)} on ${cell.date}`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted-2">
        <span>
          {plural(total)} in the last year · {label}
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          less
          {LEVEL_FILL.map((fill) => (
            <svg key={fill} width={CELL} height={CELL} viewBox={`0 0 ${CELL} ${CELL}`}>
              <rect width={CELL} height={CELL} rx={2} style={{ fill }} />
            </svg>
          ))}
          more
        </span>
      </figcaption>
    </figure>
  );
}

/** GitHub history totals, labelled so nobody reads them as score. */
export function HistoryTotals({
  commits,
  pullRequests,
  reviews,
  restricted,
}: {
  commits: number;
  pullRequests: number;
  reviews: number;
  restricted: number;
}) {
  const items = [
    { label: "commits", value: commits },
    { label: "pull requests", value: pullRequests },
    { label: "reviews", value: reviews },
    { label: "private contributions", value: restricted },
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-text-muted-2">github history · not part of score</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-white px-4 py-3">
            <dt className="text-xs text-text-muted-1">{label}</dt>
            <dd className="text-lg font-medium">{value.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
