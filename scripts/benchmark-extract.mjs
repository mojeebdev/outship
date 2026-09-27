/**
 * Extraction rules for the ETCSL translation of "The Exaltation of Inana".
 *
 * Used by `npm run verify:benchmark` and by the fixture test that proves these
 * rules behave. Kept out of `src/` on purpose: the app never fetches Oxford,
 * it reads the verified number from src/lib/word/benchmark.ts.
 *
 * The translation is selected *structurally*, not by matching prose. Every
 * line of an ETCSL translation is a block that opens with its line number or
 * line range -- "1-4." or "154." -- so a block that starts that way is
 * translation and a block that doesn't is page furniture: navigation, the
 * title, the footer, the revision history. That rule doesn't care how Oxford
 * words its headings or where the body begins, and it fails loudly rather than
 * quietly counting the wrong thing.
 *
 * What is counted: the main English translation, lines 1-154.
 * What is removed:
 *   1. Every block that is not a numbered translation line.
 *   2. The line numbers themselves, whether plain text or superscript.
 *   3. Parenthetical editorial notes: alternative manuscript readings and
 *      uncertainty markers.
 * Then HTML entities are decoded and whitespace is normalised.
 *
 * Parenthetical removal is specific to Oxford's editorial notes. The app does
 * NOT strip parentheses from users' websites.
 */

import { Parser } from "htmlparser2";

/** Elements whose text is never part of the translation. */
const DROPPED_ELEMENTS = new Set([
  "script",
  "style",
  "head",
  "title",
  "meta",
  "link",
  "noscript",
  "template",
  "svg",
  "nav",
]);

/** Elements that can hold one line of translation. */
const BLOCK_ELEMENTS = new Set(["p", "li", "td", "div", "blockquote"]);

/**
 * Inline (phrasing) elements that do not introduce a word boundary.
 *
 * Every *other* element boundary does, which matters more than it looks: the
 * live page separates some words with markup rather than whitespace, and
 * without this "the foreign lands bow low" arrives as "bowlow" and counts as
 * one word instead of two. This is the same rule the app's own extractor
 * uses, so both sides of the comparison treat markup the same way.
 */
const INLINE_ELEMENTS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "font",
  "i",
  "ins",
  "kbd",
  "mark",
  "nobr",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

/**
 * A line-number prefix.
 *
 * On the live ETCSL page the number runs straight into the text with no
 * separator at all -- "1-12Lady of all the divine powers" -- so the trailing
 * dot and the whitespace are both optional. That makes this deliberately
 * permissive: it also matches text that merely starts with a number, such as
 * a dated revision-history entry. `selectTranslationLines` filters those out
 * by requiring the lines it keeps to form a contiguous chain.
 */
const LINE_PREFIX = /^\s*(\d+)(?:\s*[-–]\s*(\d+))?\.?\s*/;

const WHITESPACE = new RegExp(
  "[\\s\\u00a0\\u1680\\u2000-\\u200a\\u202f\\u205f\\u3000\\ufeff]+",
  "gu",
);

function normalise(text) {
  return text.replace(WHITESPACE, " ").trim();
}

/**
 * Split a document into its innermost block elements.
 *
 * Only innermost blocks are returned, so a wrapper `<div>` around the
 * paragraphs never double-counts its children's text. Line numbers are kept in
 * the text at this stage -- they are what identifies a translation line.
 */
export function readBlocks(html) {
  const blocks = [];

  /** Open block elements, innermost last. */
  const stack = [];
  let skipDepth = 0;
  const skipStack = [];

  const closeBlock = () => {
    const block = stack.pop();
    if (!block) return;

    const text = normalise(block.pieces.join(""));
    // A block that contained another block has already contributed its text
    // through that child; only the innermost one is emitted.
    if (text && !block.hasBlockChild) blocks.push(text);

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.hasBlockChild = true;
      parent.pieces.push(" ", text, " ");
    }
  };

  const parser = new Parser(
    {
      onopentag(name) {
        const tag = name.toLowerCase();

        if (skipDepth > 0) {
          skipStack.push(tag);
          skipDepth += 1;
          return;
        }
        if (DROPPED_ELEMENTS.has(tag)) {
          skipStack.push(tag);
          skipDepth = 1;
          return;
        }
        if (BLOCK_ELEMENTS.has(tag)) {
          stack.push({ tag, pieces: [], hasBlockChild: false });
          return;
        }
        // Anything that is not phrasing content separates words.
        if (!INLINE_ELEMENTS.has(tag)) stack[stack.length - 1]?.pieces.push(" ");
      },
      onclosetag(name) {
        const tag = name.toLowerCase();

        if (skipDepth > 0) {
          if (skipStack[skipStack.length - 1] === tag) {
            skipStack.pop();
            skipDepth -= 1;
          }
          return;
        }
        if (BLOCK_ELEMENTS.has(tag) && stack.some((block) => block.tag === tag)) {
          // Unwind to the matching block, closing anything left open inside it.
          while (stack.length > 0) {
            const innermost = stack[stack.length - 1].tag;
            closeBlock();
            if (innermost === tag) break;
          }
          return;
        }
        if (!INLINE_ELEMENTS.has(tag)) stack[stack.length - 1]?.pieces.push(" ");
      },
      ontext(text) {
        if (skipDepth > 0) return;
        stack[stack.length - 1]?.pieces.push(text);
      },
    },
    { decodeEntities: true, recognizeSelfClosing: true },
  );

  parser.write(html);
  parser.end();

  while (stack.length > 0) closeBlock();

  return blocks;
}

/**
 * Keep only numbered translation lines, and strip the numbers.
 *
 * Returns the lines plus the range they cover, so the caller can check that
 * the whole poem was found and not, say, the first screenful.
 */
export function selectTranslationLines(blocks) {
  const candidates = [];

  for (const block of blocks) {
    const match = LINE_PREFIX.exec(block);
    if (!match) continue;

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) continue;

    candidates.push({ start, end, text: block.slice(match[0].length) });
  }

  // A poem's lines are contiguous by definition, so keep the chain that opens
  // at line 1 and advances by exactly one line per block. Anything else that
  // happens to begin with a number -- "27.i.1999 : JAB : adapting translation"
  // in the revision history, for instance -- cannot join the chain and drops
  // out, with no need for a rule about what revision histories look like.
  const lines = [];
  const rejected = [];
  let firstLine = null;
  let lastLine = null;

  for (const candidate of candidates) {
    const continuesChain =
      lines.length === 0 ? candidate.start === 1 : candidate.start === lastLine + 1;

    if (!continuesChain) {
      rejected.push(candidate);
      continue;
    }

    if (lines.length === 0) firstLine = candidate.start;
    lines.push(candidate.text);
    lastLine = candidate.end;
  }

  return { lines, firstLine, lastLine, rejected };
}

/** Remove Oxford's parenthetical editorial notes, including nested ones. */
export function stripEditorialNotes(text) {
  let previous;
  let current = text;
  do {
    previous = current;
    current = current.replace(/\([^()]*\)/g, " ");
  } while (current !== previous);
  return current;
}

export const EXPECTED_FIRST_LINE = 1;
export const EXPECTED_LAST_LINE = 154;

/**
 * Full pipeline: raw ETCSL HTML in, countable translation text out.
 *
 * Throws with a description of what it did find if the page doesn't look like
 * a translation covering lines 1-154 -- a wrong number is worse than no number.
 */
export function extractTranslation(html) {
  const blocks = readBlocks(html);
  const { lines, firstLine, lastLine } = selectTranslationLines(blocks);

  if (lines.length === 0) {
    throw new ExtractionError(
      "No numbered translation lines found. Every line of an ETCSL translation " +
        'should begin with its line number, like "1-4.".',
      blocks,
    );
  }

  if (firstLine !== EXPECTED_FIRST_LINE || lastLine !== EXPECTED_LAST_LINE) {
    throw new ExtractionError(
      `Found lines ${firstLine}-${lastLine}, expected ` +
        `${EXPECTED_FIRST_LINE}-${EXPECTED_LAST_LINE}. The page may be paginated, ` +
        "or the poem's length may have been revised.",
      blocks,
    );
  }

  return normalise(stripEditorialNotes(lines.join(" ")));
}

/** Carries the blocks it saw, so failures can be diagnosed without a re-run. */
export class ExtractionError extends Error {
  constructor(message, blocks) {
    super(message);
    this.name = "ExtractionError";
    this.blocks = blocks;
  }
}
