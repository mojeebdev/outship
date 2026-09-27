"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  BenchmarkComparison,
  ResultStats,
  type ResultViewModel,
} from "@/components/word/result-view";
import { shareText } from "@/lib/word/benchmark";
import type { ComparisonDirection } from "@/lib/word/benchmark";
import { WORD_CANONICAL_ORIGIN } from "@/lib/word/constants";

type SavedResult = {
  id: string;
  url: string;
  cardUrl: string;
  isHomepage: boolean;
  benchmarkWords: number;
  benchmarkVersion: string;
  comparison: {
    direction: ComparisonDirection;
    difference: number;
    headline: string;
  };
};

type ScanResult = {
  url: string;
  shareUrl: string;
  requestedUrl: string;
  words: number;
  characters: number;
  bytes: number;
  redirects: number;
  scanMs: number;
  cached: boolean;
  scannedAt: string;
  saved: SavedResult | null;
};

type Phase = "validating" | "fetching" | "counting" | "saving";

/** Loading copy, tied to the stage the server reports it has actually reached. */
const PHASE_COPY: Record<Phase, string> = {
  validating: "Checking that address…",
  fetching: "Fetching page…",
  counting: "Counting words…",
  saving: "Saving your result…",
};

type OptInState = "hidden" | "offered" | "saving" | "listed" | "failed";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/** Only bare homepages can be listed, so only offer the opt-in for those. */
function isHomepageRequest(requestedUrl: string): boolean {
  try {
    const parsed = new URL(requestedUrl);
    return parsed.pathname === "/" && !parsed.search;
  } catch {
    return false;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function WordCounter() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  /** Announced to assistive tech only (the numbers are already on screen). */
  const [announcement, setAnnouncement] = useState<string | null>(null);
  /** Short visible confirmation for actions like copy and opt-in. */
  const [feedback, setFeedback] = useState<string | null>(null);
  const [optIn, setOptIn] = useState<OptInState>("hidden");
  const [optInChecked, setOptInChecked] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const busy = phase !== null;

  function handleLine(line: string) {
    if (!line.trim()) return;

    let message: { type?: string; phase?: Phase; result?: ScanResult; message?: string };
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.type === "phase" && message.phase) {
      setPhase(message.phase);
      return;
    }

    if (message.type === "result" && message.result) {
      const scan = message.result;
      setResult(scan);
      setOptIn(isHomepageRequest(scan.requestedUrl) ? "offered" : "hidden");
      setOptInChecked(false);
      setAnnouncement(
        `Counted ${formatNumber(scan.words)} words and ${formatNumber(
          scan.characters,
        )} characters. ${scan.saved?.comparison.headline ?? ""}`.trim(),
      );
      return;
    }

    if (message.type === "error") {
      setError(message.message ?? "Something went wrong while counting that page.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setError(null);
    setResult(null);
    setAnnouncement(null);
    setFeedback(null);
    setOptIn("hidden");
    setPhase("validating");

    try {
      const response = await fetch("/api/word/count", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(payload?.message ?? `The counter returned HTTP ${response.status}.`);
        return;
      }

      if (!response.body) {
        // No streaming reader available: fall back to the whole body at once.
        (await response.text()).split("\n").forEach(handleLine);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handleLine);
      }
      handleLine(buffer);
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      setError("We couldn't reach the counter. Check your connection and try again.");
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setPhase(null);
      }
    }
  }

  async function handleCopy() {
    if (!result) return;

    const link = result.saved ? ` ${result.saved.url}` : "";
    const summary = `${result.shareUrl} — ${formatNumber(
      result.words,
    )} words, ${formatNumber(result.characters)} characters.${
      result.saved ? ` ${result.saved.comparison.headline}` : ""
    }${link}`;

    try {
      await navigator.clipboard.writeText(summary);
      setFeedback("Result copied to your clipboard.");
      setAnnouncement("Result copied to your clipboard.");
    } catch {
      const message = "Your browser wouldn't let us copy. Select the numbers and copy manually.";
      setFeedback(message);
      setAnnouncement(message);
    }
  }

  async function handleOptIn() {
    if (!result) return;

    setOptIn("saving");
    try {
      const response = await fetch("/api/word/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only the address is sent: the count is recalculated server-side.
        body: JSON.stringify({ url: result.requestedUrl }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setOptIn("failed");
        const message = payload?.message ?? "We couldn't add that to the leaderboard.";
        setFeedback(message);
        setAnnouncement(message);
        return;
      }

      setOptIn("listed");
      setFeedback("Added to the homepage leaderboard.");
      setAnnouncement("Added to the homepage leaderboard.");
      // Re-render the server-rendered leaderboard below.
      router.refresh();
    } catch {
      setOptIn("failed");
      setFeedback("We couldn't add that to the leaderboard.");
      setAnnouncement("We couldn't add that to the leaderboard.");
    }
  }

  function handleCountAnother() {
    setResult(null);
    setError(null);
    setFeedback(null);
    setAnnouncement(null);
    setOptIn("hidden");
    setValue("");
    inputRef.current?.focus();
  }

  const saved = result?.saved ?? null;
  const shareUrl = saved?.url ?? WORD_CANONICAL_ORIGIN;
  const shareHref = result
    ? `https://x.com/intent/post?text=${encodeURIComponent(
        shareText(result.words, saved?.isHomepage ?? isHomepageRequest(result.requestedUrl)),
      )}&url=${encodeURIComponent(shareUrl)}`
    : "#";

  const viewModel: ResultViewModel | null =
    result && saved
      ? {
          url: result.shareUrl,
          hostname: hostnameOf(result.url),
          isHomepage: saved.isHomepage,
          words: result.words,
          characters: result.characters,
          scanMs: result.scanMs,
          redirects: result.redirects,
          benchmarkWords: saved.benchmarkWords,
          comparison: saved.comparison,
        }
      : result
        ? {
            url: result.shareUrl,
            hostname: hostnameOf(result.url),
            isHomepage: isHomepageRequest(result.requestedUrl),
            words: result.words,
            characters: result.characters,
            scanMs: result.scanMs,
            redirects: result.redirects,
            benchmarkWords: 0,
            comparison: { direction: "below", difference: 0, headline: "" },
          }
        : null;

  return (
    <>
      <form className="word-form" onSubmit={handleSubmit}>
        <label className="word-label" htmlFor="word-url">
          Website address
        </label>
        <div className="word-field">
          <input
            id="word-url"
            ref={inputRef}
            name="url"
            className="word-input"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="example.com"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-describedby="word-url-hint"
            required
          />
          <button className="word-button" type="submit" disabled={busy}>
            {busy ? "Counting…" : "Count words"}
          </button>
        </div>
        <p className="word-hint" id="word-url-hint">
          A bare domain counts the homepage. Add a path to count a specific page.
        </p>
      </form>

      {phase && (
        <p className="word-status">
          <span className="word-spinner" aria-hidden="true" />
          {PHASE_COPY[phase]}
        </p>
      )}

      {/* Progress and result announcements for screen readers. */}
      <p className="word-sr-only" role="status" aria-live="polite">
        {phase ? PHASE_COPY[phase] : (announcement ?? "")}
      </p>

      {error && (
        <p className="word-error" role="alert">
          {error}
        </p>
      )}

      {result && viewModel && (
        <section className="word-result" aria-label="Scan result">
          <ResultStats result={viewModel} />

          {saved && (
            <div className="word-result-compare">
              <BenchmarkComparison headline={saved.comparison.headline} words={result.words} />
            </div>
          )}

          <div className="word-result-actions">
            <a
              className="word-button-quiet"
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on X
            </a>
            {saved && (
              <a
                className="word-button-quiet"
                href={`${saved.cardUrl}?download=1`}
                download={`word-${hostnameOf(result.url)}.png`}
              >
                Download card
              </a>
            )}
            <button type="button" className="word-button-quiet" onClick={handleCopy}>
              Copy result
            </button>
            <button type="button" className="word-button-quiet" onClick={handleCountAnother}>
              Count another page
            </button>
          </div>

          {saved ? (
            <p className="word-share-note">
              Sharing or downloading publishes this result at{" "}
              <a className="word-inline-link" href={saved.url}>
                {saved.url.replace("https://", "")}
              </a>{" "}
              — anyone with the link can see the address and the counts. The
              leaderboard below is a separate opt-in.
            </p>
          ) : (
            <p className="word-share-note">
              We couldn&apos;t save a shareable link for this scan, so the count
              above is all there is this time.
            </p>
          )}

          {optIn !== "hidden" && (
            <div className="word-opt-in">
              {optIn === "listed" ? (
                <span className="word-opt-in-done">
                  Listed on the homepage leaderboard below.
                </span>
              ) : (
                <>
                  <label htmlFor="word-opt-in">
                    <input
                      id="word-opt-in"
                      type="checkbox"
                      checked={optInChecked}
                      onChange={(event) => setOptInChecked(event.target.checked)}
                    />
                    List {hostnameOf(result.url)} publicly on the homepage leaderboard
                  </label>
                  <button
                    type="button"
                    className="word-button-quiet"
                    onClick={handleOptIn}
                    disabled={!optInChecked || optIn === "saving"}
                  >
                    {optIn === "saving" ? "Adding…" : "Add to leaderboard"}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {feedback && !phase && <p className="word-hint">{feedback}</p>}
    </>
  );
}
