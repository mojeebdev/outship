import { getCloudflareContext } from "@opennextjs/cloudflare";
import { currentAdmin } from "@/lib/admin";
import { WINDOWS, parseWindow, series, windowRanges, type SeriesKey } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const COLUMNS: SeriesKey[] = ["ships", "activeBuilders", "signIns", "newBuilders", "attestations"];

/** Every time series for a window as CSV, one row per bucket: for grant reports and spreadsheets. */
export async function GET(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return new Response("not found", { status: 404 });
  const key = parseWindow(new URL(request.url).searchParams.get("w"));
  const { env } = await getCloudflareContext({ async: true });
  const { current } = windowRanges(key);
  const bucketMs = WINDOWS[key].bucketMs;
  const all = await Promise.all(COLUMNS.map((column) => series(env.DB, column, current, bucketMs)));
  const lines = [["period_start_utc", ...COLUMNS].join(",")];
  all[0].forEach((bucket, i) => lines.push([bucket.start.toISOString(), ...all.map((column) => column[i].value)].join(",")));
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="outship-${key}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
