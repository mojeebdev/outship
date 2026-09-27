/**
 * Word — the historical benchmark every scan is compared against.
 *
 * Structured configuration, deliberately static: the app never fetches Oxford
 * on a user scan. The translation itself is not republished here — we link to
 * it. `scripts/verify-benchmark.mjs` re-derives the number from the live page
 * using the extraction rules below and the shared tokeniser, so the constant
 * can be checked rather than trusted.
 */

import { countWords } from "./count";

/**
 * Bump this whenever the tokeniser or the extraction rules change, and
 * re-verify the benchmark before shipping. Saved results record the version
 * they were produced under, so an old share link still explains itself.
 */
export const COUNTING_RULE_VERSION = "2026-09-27.1";

export const BENCHMARK = {
  words: 1521,
  title: "The Exaltation of Inana",
  /**
   * Deliberate wording: she is the earliest author known by name. This is not
   * her first writing, and not the first text ever written.
   */
  author: "Enheduanna",
  authorDescription: "the earliest author known by name",
  source: "University of Oxford, Electronic Text Corpus of Sumerian Literature (ETCSL)",
  sourceShort: "Oxford ETCSL",
  translationUrl: "https://etcsl.orinst.ox.ac.uk/section4/tr4072.htm",
  countingRuleVersion: COUNTING_RULE_VERSION,
  /** When the number above was last checked against the live translation. */
  verifiedAt: "2026-09-27",
  /**
   * What the count covers, mirrored in `scripts/verify-benchmark.mjs`.
   * The main English translation, lines 1-154, excluding page navigation, the
   * title, the footer, the revision history, superscript line numbers, and
   * Oxford's parenthetical editorial notes (alternative manuscript readings and
   * uncertainty markers).
   */
  scope: "the main English translation, lines 1-154",
} as const;

/** The one-line clarification shown under every comparison headline. */
export const BENCHMARK_CLARIFICATION =
  "Compared with Oxford's English translation of a poem attributed to Enheduanna, the earliest author known by name.";

export type ComparisonDirection = "below" | "equal" | "above";

export type Comparison = {
  direction: ComparisonDirection;
  /** Absolute difference between the page and the benchmark. */
  difference: number;
  /** The headline sentence. */
  headline: string;
  /** Short form used inside the share text. */
  shareFragment: string;
};

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function pluralWords(count: number): string {
  return count === 1 ? "word" : "words";
}

/**
 * Compare a page's word count with the benchmark.
 *
 * Says "Your page has", never "You wrote": submitting a website does not
 * establish authorship of it.
 */
export function compareToBenchmark(words: number): Comparison {
  const benchmark = BENCHMARK.words;

  if (words === benchmark) {
    return {
      direction: "equal",
      difference: 0,
      headline: `An exact match. Your page and Enheduanna's poem both have ${formatCount(
        benchmark,
      )} words.`,
      shareFragment: `an exact match with Enheduanna's poem`,
    };
  }

  if (words < benchmark) {
    const difference = benchmark - words;
    return {
      direction: "below",
      difference,
      headline: `Your page has ${formatCount(difference)} fewer ${pluralWords(
        difference,
      )} than Enheduanna's poem.`,
      shareFragment: `${formatCount(difference)} fewer than Enheduanna's poem`,
    };
  }

  const difference = words - benchmark;
  return {
    direction: "above",
    difference,
    headline: `Your page has ${formatCount(difference)} more ${pluralWords(
      difference,
    )} than Enheduanna's poem.`,
    shareFragment: `${formatCount(difference)} more than Enheduanna's poem`,
  };
}

/**
 * The text an X composer opens with. The person still chooses to post it.
 *
 * "homepage" only when a homepage was scanned — otherwise "page", because we
 * counted one page, not a site.
 */
export function shareText(words: number, isHomepage: boolean): string {
  const subject = isHomepage ? "My homepage" : "My page";
  const comparison = compareToBenchmark(words);

  if (comparison.direction === "equal") {
    return `${subject} has ${formatCount(words)} words — ${
      comparison.shareFragment
    }. How wordy is yours?`;
  }

  return `${subject} has ${formatCount(words)} words. That's ${
    comparison.shareFragment
  }. How wordy is yours?`;
}

/**
 * Re-derive the benchmark from already-extracted translation text.
 *
 * Shared with the verification script so the app and the check can never drift
 * apart on tokenisation.
 */
export function countBenchmarkText(text: string): number {
  return countWords(text);
}
