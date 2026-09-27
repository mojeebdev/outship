/**
 * Tests for the benchmark tokenisation and the ETCSL extraction rules.
 *
 * Run with: npm run test:word
 *
 * The HTML fixture below is SYNTHETIC — it reproduces the *shape* of an ETCSL
 * translation page (navigation, title, superscript line numbers, parenthetical
 * editorial notes, revision-history footer) so the extraction rules can be
 * checked deterministically offline. It is not a copy of Oxford's page, and
 * passing these tests is not the same as reproducing the live 1,521. That check
 * is `npm run verify:benchmark`, which needs network access to Oxford.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ExtractionError,
  extractTranslation,
  readBlocks,
  selectTranslationLines,
  stripEditorialNotes,
} from "../../../../scripts/benchmark-extract.mjs";
import {
  BENCHMARK,
  COUNTING_RULE_VERSION,
  compareToBenchmark,
  shareText,
} from "../benchmark";
import { countWords } from "../count";

/**
 * Shaped like the live ETCSL page, as observed from a real run:
 * the line number runs straight into the text with no dot and no space
 * ("1-12Lady of all..."), some words are separated by markup rather than
 * whitespace, and the revision history opens with a date that also begins
 * with digits.
 */
const ETCSL_SHAPED_FIXTURE = `<!doctype html>
<html><head><title>The Exaltation of Inana (Inana B): translation</title></head>
<body>
  <div class="head">The Electronic Text Corpus of Sumerian Literature Catalogues: by date | by number</div>
  <h1>The Exaltation of Inana (Inana B): translation</h1>
  <p><a name="1"></a><sup>1-12</sup>Lady of all the divine powers (2 mss. have instead: of the powers), resplendent light.</p>
  <p><a name="13"></a><sup>13-143</sup>The foreign lands bow<lb/>low before the gathering of<lb/>rulers.</p>
  <p><a name="144"></a><sup>144-154</sup>Inana's holy heart has been assuaged (uncertain reading).</p>
  <p>Top | composite text | bibliography</p>
  <p>27.i.1999-01.ii.1999 : JAB : adapting translation 02.xi.1999 : GZ : proofreading</p>
</body></html>`;

test("only numbered translation lines are counted", () => {
  const text = extractTranslation(ETCSL_SHAPED_FIXTURE);

  assert.equal(
    text,
    "Lady of all the divine powers , resplendent light. " +
      "The foreign lands bow low before the gathering of rulers. " +
      "Inana's holy heart has been assuaged .",
  );

  for (const unwanted of [
    "Electronic Text Corpus",
    "by number",
    "Inana B",
    "composite text",
    "bibliography",
    "JAB",
    "proofreading",
    "2 mss.",
    "uncertain reading",
  ]) {
    assert.ok(!text.includes(unwanted), `expected "${unwanted}" to be removed`);
  }
});

test("a line number with no dot and no space is still recognised", () => {
  // The live page's actual format, which an earlier version of these rules missed.
  const { lines, firstLine, lastLine } = selectTranslationLines([
    "1-12Lady of all the divine powers",
    "13-154Praise be to the destroyer of foreign lands",
  ]);

  assert.deepEqual(lines, [
    "Lady of all the divine powers",
    "Praise be to the destroyer of foreign lands",
  ]);
  assert.equal(firstLine, 1);
  assert.equal(lastLine, 154);
});

test("the dotted and spaced forms are recognised too", () => {
  const { lines } = selectTranslationLines(["1-4. Lady of all", "5 - 154 Woman, you are great"]);
  assert.deepEqual(lines, ["Lady of all", "Woman, you are great"]);
});

test("words separated by markup rather than whitespace stay separate", () => {
  // Without this, "bow low" arrives as "bowlow" and counts once instead of twice.
  const blocks = readBlocks("<p>the foreign lands bow<lb/>low today</p>");
  assert.deepEqual(blocks, ["the foreign lands bow low today"]);
  assert.equal(countWords(blocks[0]), 6);

  // Phrasing elements must NOT introduce a break.
  assert.deepEqual(readBlocks("<p><b>Inan</b>a<sup>1</sup></p>"), ["Inana1"]);
  assert.deepEqual(readBlocks('<p><a name="1"></a>Lady</p>'), ["Lady"]);
});

test("a dated revision-history entry cannot join the line chain", () => {
  const { lines, lastLine, rejected } = selectTranslationLines([
    "1-154The whole poem",
    "27.i.1999-01.ii.1999 : JAB : adapting translation",
  ]);

  assert.deepEqual(lines, ["The whole poem"]);
  assert.equal(lastLine, 154);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].start, 27);
});

test("lines must form a contiguous chain from 1", () => {
  // A gap means something was missed; the chain stops and validation fails.
  const { lines, lastLine } = selectTranslationLines([
    "1-12first",
    "20-154skipped ahead",
  ]);
  assert.deepEqual(lines, ["first"]);
  assert.equal(lastLine, 12);
});

test("a wrapper element does not double-count its paragraphs", () => {
  assert.deepEqual(readBlocks("<div><div><p>alpha</p><p>beta</p></div></div>"), [
    "alpha",
    "beta",
  ]);
});

test("blocks other than <p> can carry a line", () => {
  const { lines, firstLine, lastLine } = selectTranslationLines(
    readBlocks("<ul><li>1-100first line</li><li>101-154second line</li></ul>"),
  );
  assert.deepEqual(lines, ["first line", "second line"]);
  assert.equal(firstLine, 1);
  assert.equal(lastLine, 154);
});

test("extraction fails loudly rather than counting the wrong thing", () => {
  assert.throws(
    () => extractTranslation("<html><body><p>Some other page entirely.</p></body></html>"),
    (error: unknown) =>
      error instanceof ExtractionError &&
      /No numbered translation lines found/.test(error.message),
  );

  assert.throws(
    () => extractTranslation("<p>1-4Lady of all</p><p>5-8Woman, you are great</p>"),
    (error: unknown) =>
      error instanceof ExtractionError && /Found lines 1-8, expected 1-154/.test(error.message),
  );
});

test("a failed extraction carries the blocks it saw, for diagnosis", () => {
  try {
    extractTranslation("<html><body><p>alpha</p><p>beta</p></body></html>");
    assert.fail("expected extraction to fail");
  } catch (error) {
    assert.ok(error instanceof ExtractionError);
    assert.deepEqual(error.blocks, ["alpha", "beta"]);
  }
});

test("parenthetical editorial notes are removed, including nested ones", () => {
  const clean = (input: string) => stripEditorialNotes(input).replace(/\s+/g, " ").trim();
  assert.equal(clean("powers (or: of the powers) shine"), "powers shine");
  assert.equal(clean("great (uncertain (very) reading) indeed"), "great indeed");
});

test("the benchmark configuration is complete and self-consistent", () => {
  assert.equal(BENCHMARK.words, 1521);
  assert.equal(BENCHMARK.countingRuleVersion, COUNTING_RULE_VERSION);
  assert.equal(BENCHMARK.title, "The Exaltation of Inana");
  assert.match(BENCHMARK.translationUrl, /^https:\/\/etcsl\.orinst\.ox\.ac\.uk\//);
  assert.match(BENCHMARK.authorDescription, /earliest author known by name/);
  assert.match(BENCHMARK.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("comparison copy: below, equal and above", () => {
  assert.equal(
    compareToBenchmark(1000).headline,
    "Your page has 521 fewer words than Enheduanna's poem.",
  );
  assert.equal(
    compareToBenchmark(1521).headline,
    "An exact match. Your page and Enheduanna's poem both have 1,521 words.",
  );
  assert.equal(
    compareToBenchmark(2000).headline,
    "Your page has 479 more words than Enheduanna's poem.",
  );
  assert.equal(compareToBenchmark(1000).direction, "below");
  assert.equal(compareToBenchmark(1521).direction, "equal");
  assert.equal(compareToBenchmark(2000).direction, "above");
  assert.equal(compareToBenchmark(2000).difference, 479);
});

test("comparison copy: singular wording and thousands separators", () => {
  assert.equal(
    compareToBenchmark(1520).headline,
    "Your page has 1 fewer word than Enheduanna's poem.",
  );
  assert.equal(
    compareToBenchmark(1522).headline,
    "Your page has 1 more word than Enheduanna's poem.",
  );
  assert.match(compareToBenchmark(12000).headline, /10,479 more words/);
  assert.match(compareToBenchmark(0).headline, /1,521 fewer words/);
});

test("comparison copy never claims authorship or a record", () => {
  for (const words of [0, 1520, 1521, 1522, 50_000]) {
    const { headline } = compareToBenchmark(words);
    assert.match(headline, /^(Your page has|An exact match\.)/);
    assert.ok(!/you wrote/i.test(headline));
    assert.ok(!/record|beat|surpass/i.test(headline));
  }
});

test("share text carries the sharer's number and the challenge", () => {
  assert.equal(
    shareText(534, true),
    "how wordyyyyyyyyyy is your website???\n\n" +
      "my homepage has 534 words. can yours beat a 4,300-year-old poem? 1,521 words.",
  );
  assert.equal(
    shareText(2000, false),
    "how wordyyyyyyyyyy is your website???\n\n" +
      "my page has 2,000 words. can yours beat a 4,300-year-old poem? 1,521 words.",
  );
});

test("share text says homepage only for a homepage", () => {
  assert.match(shareText(100, true), /my homepage has/);
  assert.match(shareText(100, false), /my page has/);
});

test("share text uses thousands separators on both numbers", () => {
  const text = shareText(12345, true);
  assert.match(text, /my homepage has 12,345 words/);
  assert.match(text, /1,521 words\./);
  assert.ok(!text.includes("12345"));
  assert.ok(!text.includes("1521"));
});

test("share text makes no claim the poem is a first or a novel", () => {
  for (const words of [1, 534, 1521, 90_000]) {
    const text = shareText(words, true).toLowerCase();
    for (const forbidden of ["novel", "first novel", "first text", "first writing", "oldest book"]) {
      assert.ok(!text.includes(forbidden), `share text must not say "${forbidden}"`);
    }
  }
});
