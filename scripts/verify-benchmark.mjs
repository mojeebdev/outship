/**
 * Re-derive Word's historical benchmark from the live ETCSL translation.
 *
 *   npm run verify:benchmark
 *   npm run verify:benchmark -- --html path/to/saved.htm   (work offline)
 *
 * Fetches Oxford's page, applies the extraction rules
 * (scripts/benchmark-extract.mjs) and the app's own tokeniser
 * (src/lib/word/count.ts), and compares the result with the number configured
 * in src/lib/word/benchmark.ts.
 *
 * This runs on demand, never during a user scan. If the number differs, work
 * out whether the extraction or the tokenisation moved before touching the
 * constant, then bump COUNTING_RULE_VERSION.
 *
 * On failure it prints what it actually found on the page, so the rules can be
 * corrected without a second round trip, and saves the raw HTML next to the
 * script for offline work.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BENCHMARK } from "../src/lib/word/benchmark.ts";
import { countWords } from "../src/lib/word/count.ts";
import {
  EXPECTED_FIRST_LINE,
  EXPECTED_LAST_LINE,
  ExtractionError,
  extractTranslation,
  readBlocks,
  selectTranslationLines,
} from "./benchmark-extract.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.join(scriptDir, ".cache", "etcsl-tr4072.html");

const args = process.argv.slice(2);
const htmlFlag = args.indexOf("--html");
const localHtmlPath = htmlFlag === -1 ? null : args[htmlFlag + 1];
const url = args.find((arg) => arg.startsWith("http")) ?? BENCHMARK.translationUrl;

/** Exit codes: 0 match, 1 mismatch, 2 could not check. */
function fail(code, ...lines) {
  for (const line of lines) console.error(line);
  // Set the code rather than calling process.exit(): an abrupt exit while the
  // module loader's worker thread is live aborts the process on Windows.
  process.exitCode = code;
}

console.log(`Source:   ${localHtmlPath ?? url}`);
console.log(`Scope:    ${BENCHMARK.scope}`);
console.log(`Expected: ${BENCHMARK.words.toLocaleString("en-US")} words`);
console.log(`Rules:    ${BENCHMARK.countingRuleVersion}\n`);

/** Print enough of the page to correct the extraction rules from. */
function describePage(blocks) {
  console.error(`\nWhat the page actually looks like (${blocks.length} text blocks):\n`);

  const preview = blocks.slice(0, 25);
  preview.forEach((block, index) => {
    const text = block.length > 160 ? `${block.slice(0, 160)}…` : block;
    console.error(`  [${String(index).padStart(2)}] ${text}`);
  });
  if (blocks.length > preview.length) {
    console.error(`  … and ${blocks.length - preview.length} more blocks`);
  }

  const { firstLine, lastLine, lines, rejected } = selectTranslationLines(blocks);
  console.error(
    `\nNumbered lines accepted: ${lines.length}` +
      (lines.length > 0 ? ` (covering ${firstLine}-${lastLine})` : ""),
  );
  if (rejected.length > 0) {
    // Blocks that opened with a number but couldn't join the chain. Usually
    // that's page furniture doing its job; a run of them means the chain broke.
    const shown = rejected
      .slice(0, 8)
      .map((candidate) => `${candidate.start}-${candidate.end}`)
      .join(", ");
    console.error(`Numbered blocks rejected as out of sequence: ${rejected.length} (${shown})`);
  }
  console.error(
    `Expected the line-numbered blocks to run contiguously from ` +
      `${EXPECTED_FIRST_LINE} to ${EXPECTED_LAST_LINE}.`,
  );
}

let html;
if (localHtmlPath) {
  try {
    html = await readFile(localHtmlPath, "utf8");
  } catch (error) {
    fail(2, `Could not read ${localHtmlPath}: ${error.message}`);
  }
} else {
  try {
    const response = await fetch(url, {
      headers: { accept: "text/html", "user-agent": "WordBenchmarkCheck/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (error) {
    fail(
      2,
      `Could not fetch the translation: ${error.message}`,
      "Run this from a network that can reach etcsl.orinst.ox.ac.uk, or pass",
      "a saved copy with: npm run verify:benchmark -- --html path/to/saved.htm",
    );
  }
}

if (html) {
  // Keep a copy so the rules can be worked on without hitting Oxford again.
  try {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, html, "utf8");
    console.log(`Saved a copy of the page to ${path.relative(process.cwd(), cachePath)}\n`);
  } catch {
    // Not being able to cache is never a reason to fail the check.
  }

  let text;
  try {
    text = extractTranslation(html);
  } catch (error) {
    fail(2, `Extraction failed: ${error.message}`);
    describePage(error instanceof ExtractionError ? error.blocks : readBlocks(html));
  }

  if (text) {
    const actual = countWords(text);

    // Print the edges of the extracted window so a human can confirm it starts
    // and ends where it should.
    console.log(`First 200 chars: ${text.slice(0, 200)}`);
    console.log(`Last 200 chars:  ${text.slice(-200)}\n`);
    console.log(`Counted:  ${actual.toLocaleString("en-US")} words`);

    if (actual === BENCHMARK.words) {
      console.log("\nMatches the configured benchmark.");
    } else {
      fail(
        1,
        `\nMISMATCH: counted ${actual.toLocaleString("en-US")}, configured ` +
          `${BENCHMARK.words.toLocaleString("en-US")} (difference ` +
          `${Math.abs(actual - BENCHMARK.words).toLocaleString("en-US")}).`,
        "Investigate extraction and tokenisation before changing the constant.",
      );
    }
  }
}
