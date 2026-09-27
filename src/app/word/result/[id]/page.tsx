import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlindspotLabBadge } from "@/components/word/blindspotlab-badge";
import { BenchmarkComparison, ResultStats } from "@/components/word/result-view";
import { BENCHMARK, shareText } from "@/lib/word/benchmark";
import { getWordBasePath, wordHref } from "@/lib/word/paths";
import { getResult, resultCardUrl, resultUrl } from "@/lib/word/results";

export const dynamic = "force-dynamic";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Metadata is built on the server from the saved record, with absolute
 * production URLs, so it is present in the very first HTML response and needs
 * no login and no client-side JavaScript to read.
 */
export async function generateMetadata({
  params,
}: PageProps<"/word/result/[id]">): Promise<Metadata> {
  const { id } = await params;
  const result = await getResult(id);

  if (!result) {
    return { title: "Result not found", robots: { index: false, follow: false } };
  }

  const title = `${result.hostname} has ${formatNumber(result.words)} words`;
  const description = `${result.comparison.headline} Counted on one page by Word.`;
  const canonical = resultUrl(result.id);
  const card = resultCardUrl(result.id);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Word",
      type: "article",
      images: [
        {
          url: card,
          width: 1200,
          height: 630,
          alt: `${result.hostname}: ${formatNumber(result.words)} words`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [card],
    },
  };
}

export default async function WordResultPage({ params }: PageProps<"/word/result/[id]">) {
  const { id } = await params;
  const result = await getResult(id);

  if (!result) notFound();

  const home = wordHref(await getWordBasePath(), "/");
  const share = `https://x.com/intent/post?text=${encodeURIComponent(
    shareText(result.words, result.isHomepage),
  )}&url=${encodeURIComponent(resultUrl(result.id))}`;

  return (
    <>
      <section className="word-hero word-hero-compact">
        <BlindspotLabBadge />
        <h1>
          {result.hostname} has <em>{formatNumber(result.words)}</em>{" "}
          {result.words === 1 ? "word" : "words"}
        </h1>
        <p className="word-hero-sub">
          on {result.isHomepage ? "its homepage" : "the page below"}. Counted by Word on{" "}
          <time dateTime={result.scannedAt}>{result.scannedAt.slice(0, 10)}</time>.
        </p>
      </section>

      <section className="word-result" aria-label="Scan result">
        <ResultStats
          result={{
            url: result.url,
            hostname: result.hostname,
            isHomepage: result.isHomepage,
            words: result.words,
            characters: result.characters,
            scanMs: result.scanMs,
            benchmarkWords: result.benchmarkWords,
            comparison: result.comparison,
          }}
        />

        <div className="word-result-compare">
          <BenchmarkComparison headline={result.comparison.headline} words={result.words} />
        </div>

        <div className="word-result-actions">
          <a className="word-button-quiet" href={share} target="_blank" rel="noopener noreferrer">
            Share on X
          </a>
          <a
            className="word-button-quiet"
            href={`${resultCardUrl(result.id)}?download=1`}
            download={`word-${result.hostname}.png`}
          >
            Download card
          </a>
        </div>
      </section>

      <section className="word-cta">
        <h2>How wordy is your website?</h2>
        <p>Count any page in a few seconds, then see how it compares.</p>
        <Link className="word-button" href={home}>
          Check your website
        </Link>
      </section>

      <p className="word-section-note word-result-footnote">
        Counting rules {result.benchmarkVersion}. Benchmark:{" "}
        {formatNumber(result.benchmarkWords)} words from{" "}
        <a
          className="word-inline-link"
          href={BENCHMARK.translationUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {BENCHMARK.title}
        </a>
        . Source: {BENCHMARK.source}.
      </p>
    </>
  );
}
