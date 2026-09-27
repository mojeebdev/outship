import { AnimatedCount } from "@/components/word/animated-count";
import { AUTHOR_IMAGE, BENCHMARK, BENCHMARK_CLARIFICATION } from "@/lib/word/benchmark";
import type { ComparisonDirection } from "@/lib/word/benchmark";

/** Everything the result screen needs, from a scan or from a saved snapshot. */
export type ResultViewModel = {
  url: string;
  hostname: string;
  isHomepage: boolean;
  words: number;
  characters: number;
  scanMs: number;
  redirects?: number;
  benchmarkWords: number;
  comparison: {
    direction: ComparisonDirection;
    difference: number;
    headline: string;
  };
};

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

/**
 * The historical comparison.
 *
 * Deliberately says "Your page has", never "You wrote": submitting a website
 * does not establish authorship of it.
 *
 * The image is the artefact, not a likeness of the author — no contemporary
 * portrait of Enheduanna exists. Its label says exactly that, and its licence
 * and provenance are recorded in `AUTHOR_IMAGE`.
 */
export function BenchmarkComparison({
  headline,
  words,
}: {
  headline: string;
  words: number;
}) {
  return (
    <section className="word-compare" aria-label="Historical comparison">
      <div className="word-compare-top">
        <figure className="word-compare-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local asset; the Workers image optimiser adds nothing at 112px */}
          <img
            src={AUTHOR_IMAGE.src}
            alt={AUTHOR_IMAGE.label}
            width={112}
            height={112}
            loading="lazy"
            decoding="async"
          />
          <figcaption>{AUTHOR_IMAGE.label}</figcaption>
        </figure>

        <div className="word-compare-copy">
          <p className="word-compare-headline">{headline}</p>

          <p className="word-compare-work">
            <em>{BENCHMARK.title}</em>
          </p>

          <p className="word-compare-note">{BENCHMARK_CLARIFICATION}</p>
        </div>
      </div>

      <div className="word-compare-bars">
        <ComparisonBar
          label={`${BENCHMARK.author}'s poem`}
          value={BENCHMARK.words}
          max={Math.max(words, BENCHMARK.words)}
          tone="benchmark"
        />
        <ComparisonBar
          label="This page"
          value={words}
          max={Math.max(words, BENCHMARK.words)}
          tone="page"
        />
      </div>

      <details className="word-how">
        <summary>How we count</summary>
        <div className="word-how-body">
          <p>
            Both numbers come from the same rule: a word is a run of letters or
            numbers, which may hold apostrophes or hyphens inside it. Punctuation
            and symbols are not words.
          </p>
          <p>
            The benchmark is {formatNumber(BENCHMARK.words)} words from{" "}
            {BENCHMARK.scope} of{" "}
            <a
              className="word-inline-link"
              href={BENCHMARK.translationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {BENCHMARK.title}
            </a>
            , excluding page navigation, the title, the footer, the revision
            history, superscript line numbers and Oxford&apos;s parenthetical
            editorial notes. Your page is counted as it is — ordinary
            parentheses are left alone.
          </p>
          <p className="word-how-source">
            Source: {BENCHMARK.source}. Counting rules{" "}
            {BENCHMARK.countingRuleVersion}, checked {BENCHMARK.verifiedAt}.
          </p>
          <p className="word-how-source">
            Image: {AUTHOR_IMAGE.object}{" "}
            <a
              className="word-inline-link"
              href={AUTHOR_IMAGE.sourcePage}
              target="_blank"
              rel="noopener noreferrer"
            >
              {AUTHOR_IMAGE.credit}
            </a>
            , cropped and resized.
          </p>
        </div>
      </details>
    </section>
  );
}

function ComparisonBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "benchmark" | "page";
}) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;

  return (
    <div className="word-bar-row">
      <span className="word-bar-label">{label}</span>
      <span className="word-bar-track">
        <span className={`word-bar-fill word-bar-${tone}`} style={{ width: `${width}%` }} />
      </span>
      <span className="word-bar-value">{formatNumber(value)}</span>
    </div>
  );
}

/** Domain, page and the three headline numbers. */
export function ResultStats({ result }: { result: ResultViewModel }) {
  return (
    <>
      <p className="word-result-head">
        Counted <strong>{result.url}</strong>
        {result.redirects ? (
          <> after {result.redirects} redirect{result.redirects === 1 ? "" : "s"}</>
        ) : null}
      </p>

      <div className="word-stats">
        <p className="word-stat-primary">
          <AnimatedCount value={result.words} className="word-stat-value" />
          <span className="word-stat-label">Words</span>
        </p>
        <p>
          <span className="word-stat-value">{formatNumber(result.characters)}</span>
          <span className="word-stat-label">Characters, spaces included</span>
        </p>
        <p>
          <span className="word-stat-value">{formatDuration(result.scanMs)}</span>
          <span className="word-stat-label">Scan time</span>
        </p>
      </div>
    </>
  );
}
