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
  /**
   * When the number above was last counted from the live translation by
   * `npm run verify:benchmark`. It matched exactly on this date.
   */
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

/**
 * A photograph of the artefact, with the provenance that makes it usable.
 *
 * This is the object itself, not a likeness: no contemporary portrait of
 * Enheduanna exists, and a modern imagining presented as one would be a
 * fabrication. The label is fixed for that reason — it describes a depiction
 * on a disk, and claims nothing more.
 *
 * Licence verified against the Commons file page's own metadata on the date
 * below. CC0 imposes no conditions at all, so the credit here is courtesy
 * rather than obligation.
 */
export const AUTHOR_IMAGE = {
  /** Served from `public/`, so the URL is clean on both hostnames. */
  src: "/enheduanna-disk.jpg",
  /** The required label, used as both alt text and visible caption. */
  label: "Depiction of Enheduanna on an ancient disk.",
  object:
    "Disk of Enheduanna. Alabaster, c. 2350-2300 BCE, from Ur. Penn Museum, object B16665.",
  creator: "Mefman00",
  licence: "CC0 1.0 Universal (Public Domain Dedication)",
  licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  attributionRequired: false,
  credit: "Photograph by Mefman00 via Wikimedia Commons (CC0)",
  sourcePage: "https://commons.wikimedia.org/wiki/File:Disk_of_Enheduanna.JPG",
  sourceFile:
    "https://upload.wikimedia.org/wikipedia/commons/a/ad/Disk_of_Enheduanna.JPG",
  /** What was changed from the source, which CC0 permits without note. */
  modifications:
    "Cropped square to the disk and resized to 480px; the source is 6000x4000.",
  verifiedAt: "2026-09-27",
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
 * Carries the sharer's own number, then hands the reader a challenge. It
 * deliberately does not repeat the comparison ("987 fewer than…") — the share
 * card sits directly beneath and already shows the domain, the count and the
 * comparison, so saying it twice wastes the line that could invite a reply.
 *
 * "4,300-year-old" is deliberately round: the poem is dated c. 2300 BC, and a
 * figure derived from the current year would drift by one every January for no
 * benefit. The word count comes from BENCHMARK so the two cannot disagree.
 *
 * "homepage" only when a homepage was scanned — otherwise "page", because one
 * page was counted, not a site.
 */
export function shareText(words: number, isHomepage: boolean): string {
  const subject = isHomepage ? "my homepage" : "my page";

  return [
    "how wordyyyyyyyyyy is your website???",
    "",
    `${subject} has ${formatCount(words)} words. can yours beat a 4,300-year-old poem? ` +
      `${formatCount(BENCHMARK.words)} words.`,
  ].join("\n");
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
