/**
 * GET /api/word/card/{id} — the 1200x630 share card for a saved result.
 *
 * Served from `/api/` on purpose: API routes are excluded from the hostname
 * rewrite in `src/proxy.ts`, so this URL resolves identically on outship.dev
 * and word.outship.dev with no redirect and no internal `/word` prefix leaking
 * into Open Graph metadata.
 *
 * The card is drawn from the saved, server-verified record only — never from
 * numbers passed in the query string. `?download=1` returns the same artwork as
 * an attachment.
 */

import { ImageResponse } from "next/og";

import { BENCHMARK } from "@/lib/word/benchmark";
import { getResult } from "@/lib/word/results";

export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;

/** Safe margin: nothing meaningful comes closer than this to an edge. */
const MARGIN = 64;

const INK = "#0c0c12";
const INK_2 = "#4a4a5a";
const INK_3 = "#6e6e7c";
const ACCENT = "#0284c7";
const BG = "#fafaf8";
const BORDER = "#e3e3dd";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export async function GET(request: Request, context: RouteContext<"/api/word/card/[id]">) {
  const { id } = await context.params;
  const result = await getResult(id);

  if (!result) {
    return new Response("Result not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const wordLabel = result.words === 1 ? "word" : "words";

  const image = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: MARGIN,
          background: BG,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        {/* Branding */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 10,
                background: ACCENT,
                color: "#ffffff",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              W
            </div>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Word</span>
          </div>
          <span style={{ fontSize: 22, color: INK_3 }}>How wordy is your website?</span>
        </div>

        {/* The numbers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 30, color: INK_2 }}>{result.hostname}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ fontSize: 148, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
              {formatNumber(result.words)}
            </span>
            <span style={{ fontSize: 40, color: INK_2 }}>{wordLabel}</span>
          </div>
          <span style={{ fontSize: 34, color: ACCENT, marginTop: 10 }}>
            {result.comparison.headline}
          </span>
          <span style={{ fontSize: 22, color: INK_3, marginTop: 6 }}>
            Compared with {BENCHMARK.title}, attributed to {BENCHMARK.author} —{" "}
            {BENCHMARK.authorDescription}.
          </span>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 22,
            borderTop: `2px solid ${BORDER}`,
            fontSize: 22,
            color: INK_3,
          }}
        >
          <span>word.outship.dev</span>
          <span>A BlindspotLab product</span>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );

  const headers = new Headers(image.headers);
  headers.set("cache-control", "public, max-age=3600, s-maxage=86400");
  if (download) {
    headers.set("content-disposition", `attachment; filename="word-${result.hostname}.png"`);
  }

  return new Response(image.body, { status: 200, headers });
}
