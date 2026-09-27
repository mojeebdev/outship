/**
 * POST /api/word/count — fetch a page server-side and count its words.
 *
 * Namespaced under `/api/word/` and excluded from the hostname rewrite in
 * `src/proxy.ts`, so it resolves identically on outship.dev and
 * word.outship.dev.
 *
 * The response is newline-delimited JSON: progress lines as the scan actually
 * moves between stages, then one terminal `result` or `error` line. That keeps
 * the UI's loading copy tied to real work instead of a synthetic timer.
 */

import { ScanError, scanUrl, type ScanPhase } from "@/lib/word/scan";
import { resultCardUrl, resultUrl, saveResult } from "@/lib/word/results";
import { UnsafeUrlError, validateSubmittedUrl } from "@/lib/word/url";
import { clientIdentifier, consumeRateLimit } from "@/lib/word/rate-limit";

export const dynamic = "force-dynamic";

/** The scan's own phases, plus the save step that follows it. */
type ReportedPhase = ScanPhase | "saving";

type StreamLine =
  | { type: "phase"; phase: ReportedPhase }
  | { type: "result"; result: unknown }
  | { type: "error"; code: string; message: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const input = typeof body?.url === "string" ? body.url : "";

  // Syntactic problems — bad scheme, private host, odd port — are answered with
  // a real status code before we open a stream. Everything after this point
  // (DNS, the fetch itself, the count) is reported in-band.
  try {
    validateSubmittedUrl(input);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return Response.json({ code: error.reason, message: error.message }, { status: 400 });
    }
    throw error;
  }

  const verdict = await consumeRateLimit(clientIdentifier(request), "word-count");
  if (!verdict.allowed) {
    return Response.json(
      {
        code: "rate-limited",
        message: "That's a lot of counting. Give it a minute and try again.",
      },
      {
        status: 429,
        headers: { "retry-after": String(verdict.retryAfterSeconds ?? 60) },
      },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: StreamLine) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      };

      try {
        const scan = await scanUrl(input, {
          onPhase: (phase) => send({ type: "phase", phase }),
        });

        // Persist the scan so it has a shareable, opaque id. A save failure is
        // not a scan failure: the count is still correct and still shown, just
        // without a share link.
        send({ type: "phase", phase: "saving" });
        const saved = await saveResult(scan);

        send({
          type: "result",
          result: {
            ...scan,
            saved: saved
              ? {
                  id: saved.id,
                  url: resultUrl(saved.id),
                  cardUrl: resultCardUrl(saved.id),
                  isHomepage: saved.isHomepage,
                  comparison: saved.comparison,
                  benchmarkWords: saved.benchmarkWords,
                  benchmarkVersion: saved.benchmarkVersion,
                }
              : null,
          },
        });
      } catch (error) {
        if (error instanceof ScanError) {
          send({ type: "error", code: error.code, message: error.message });
        } else {
          send({
            type: "error",
            code: "unknown",
            message: "Something went wrong while counting that page.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
