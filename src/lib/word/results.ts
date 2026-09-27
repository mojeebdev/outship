/**
 * Word — saved scan results.
 *
 * Every successful scan gets an opaque, unguessable id and a row here, so it
 * can be shared at word.outship.dev/result/{id}. The row is a snapshot: the
 * numbers, the comparison and the counting-rule version are stored as they were
 * at scan time, so an old link never silently changes meaning.
 *
 * Only the query-stripped URL is stored — never credentials or query strings.
 */

import { getDb } from "@/lib/db";
import { BENCHMARK, compareToBenchmark, type ComparisonDirection } from "./benchmark";
import { WORD_CANONICAL_ORIGIN } from "./constants";
import { isHomepage, normalizeHostname, shareableUrl } from "./url";
import type { ScanResult } from "./scan";

/** Crockford-style base32: no i, l, o or u, so ids are hard to misread. */
const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const ID_LENGTH = 16;
const ID_PATTERN = /^[0-9a-hjkmnp-tv-z]{16}$/;

/** 80 bits of randomness. 256 is a multiple of 32, so the mapping is unbiased. */
export function newResultId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("");
}

export function isValidResultId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export type SavedResult = {
  id: string;
  url: string;
  hostname: string;
  isHomepage: boolean;
  words: number;
  characters: number;
  scanMs: number;
  scannedAt: string;
  benchmarkWords: number;
  benchmarkVersion: string;
  comparison: {
    direction: ComparisonDirection;
    difference: number;
    headline: string;
  };
};

/** The public URL for a saved result. Always the production origin. */
export function resultUrl(id: string): string {
  return `${WORD_CANONICAL_ORIGIN}/result/${id}`;
}

/** The public URL for a result's share card image. */
export function resultCardUrl(id: string): string {
  return `${WORD_CANONICAL_ORIGIN}/api/word/card/${id}`;
}

/**
 * Persist a scan.
 *
 * Returns `null` rather than throwing if the database is unavailable — a scan
 * that can't be saved should still show its count, just without a share link.
 */
export async function saveResult(scan: ScanResult): Promise<SavedResult | null> {
  const url = shareableUrl(scan.url);
  const comparison = compareToBenchmark(scan.words);
  const saved: SavedResult = {
    id: newResultId(),
    url,
    hostname: normalizeHostname(url),
    // Whether the *submitted* address was a bare homepage decides the wording.
    isHomepage: isHomepage(scan.requestedUrl),
    words: scan.words,
    characters: scan.characters,
    scanMs: scan.scanMs,
    scannedAt: scan.scannedAt,
    benchmarkWords: BENCHMARK.words,
    benchmarkVersion: BENCHMARK.countingRuleVersion,
    comparison: {
      direction: comparison.direction,
      difference: comparison.difference,
      headline: comparison.headline,
    },
  };

  try {
    const db = await getDb();
    await db.wordResult.create({
      data: {
        id: saved.id,
        url: saved.url,
        hostname: saved.hostname,
        isHomepage: saved.isHomepage,
        words: saved.words,
        characters: saved.characters,
        scanMs: saved.scanMs,
        benchmarkWords: saved.benchmarkWords,
        benchmarkVersion: saved.benchmarkVersion,
        comparisonDirection: saved.comparison.direction,
        comparisonDifference: saved.comparison.difference,
        createdAt: new Date(saved.scannedAt),
      },
    });
    return saved;
  } catch {
    return null;
  }
}

/** Read a saved result. `null` for an unknown or malformed id. */
export async function getResult(id: string): Promise<SavedResult | null> {
  if (!isValidResultId(id)) return null;

  try {
    const db = await getDb();
    const row = await db.wordResult.findUnique({ where: { id } });
    if (!row) return null;

    // The headline is rebuilt from the stored direction and difference, so the
    // snapshot's numbers -- not today's benchmark -- decide what it says.
    return {
      id: row.id,
      url: row.url,
      hostname: row.hostname,
      isHomepage: row.isHomepage,
      words: row.words,
      characters: row.characters,
      scanMs: row.scanMs,
      scannedAt: row.createdAt.toISOString(),
      benchmarkWords: row.benchmarkWords,
      benchmarkVersion: row.benchmarkVersion,
      comparison: {
        direction: row.comparisonDirection as ComparisonDirection,
        difference: row.comparisonDifference,
        headline: headlineFor(
          row.comparisonDirection as ComparisonDirection,
          row.comparisonDifference,
          row.benchmarkWords,
        ),
      },
    };
  } catch {
    return null;
  }
}

/** Rebuild a stored comparison's headline from the snapshot's own numbers. */
function headlineFor(
  direction: ComparisonDirection,
  difference: number,
  benchmarkWords: number,
): string {
  const count = difference.toLocaleString("en-US");
  const noun = difference === 1 ? "word" : "words";

  if (direction === "equal") {
    return `An exact match. Your page and Enheduanna's poem both have ${benchmarkWords.toLocaleString(
      "en-US",
    )} words.`;
  }
  if (direction === "below") {
    return `Your page has ${count} fewer ${noun} than Enheduanna's poem.`;
  }
  return `Your page has ${count} more ${noun} than Enheduanna's poem.`;
}
