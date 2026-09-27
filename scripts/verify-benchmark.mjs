/**
 * Re-derive Word's historical benchmark from the live ETCSL translation.
 *
 *   npm run verify:benchmark
 *
 * Fetches Oxford's page, applies the documented extraction rules
 * (scripts/benchmark-extract.mjs) and the app's own tokeniser
 * (src/lib/word/count.ts), and compares the result with the number configured
 * in src/lib/word/benchmark.ts.
 *
 * This runs on demand, never during a user scan. If the number differs, work
 * out whether the extraction or the tokenisation moved before touching the
 * constant, then bump COUNTING_RULE_VERSION.
 */

import { BENCHMARK } from "../src/lib/word/benchmark.ts";
import { countWords } from "../src/lib/word/count.ts";
import { extractTranslation } from "./benchmark-extract.mjs";

const url = process.argv[2] ?? BENCHMARK.translationUrl;

console.log(`Source:   ${url}`);
console.log(`Scope:    ${BENCHMARK.scope}`);
console.log(`Expected: ${BENCHMARK.words.toLocaleString("en-US")} words`);
console.log(`Rules:    ${BENCHMARK.countingRuleVersion}\n`);

let html;
try {
  const response = await fetch(url, {
    headers: { accept: "text/html", "user-agent": "WordBenchmarkCheck/1.0" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  html = await response.text();
} catch (error) {
  console.error(`Could not fetch the translation: ${error.message}`);
  console.error("Run this from a network that can reach etcsl.orinst.ox.ac.uk.");
  process.exit(2);
}

let text;
try {
  text = extractTranslation(html);
} catch (error) {
  console.error(`Extraction failed: ${error.message}`);
  console.error("Oxford's markup may have changed — check the markers in scripts/benchmark-extract.mjs.");
  process.exit(2);
}

const actual = countWords(text);

// Print the edges of the extracted window so a human can confirm it starts and
// ends where it should.
console.log(`First 200 chars: ${text.slice(0, 200)}`);
console.log(`Last 200 chars:  ${text.slice(-200)}\n`);
console.log(`Counted:  ${actual.toLocaleString("en-US")} words`);

if (actual === BENCHMARK.words) {
  console.log("\nMatches the configured benchmark.");
  process.exit(0);
}

console.error(
  `\nMISMATCH: counted ${actual.toLocaleString("en-US")}, configured ${BENCHMARK.words.toLocaleString(
    "en-US",
  )} (difference ${Math.abs(actual - BENCHMARK.words).toLocaleString("en-US")}).`,
);
console.error("Investigate extraction and tokenisation before changing the constant.");
process.exit(1);
