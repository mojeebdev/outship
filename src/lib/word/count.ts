/**
 * Word — the counting engine.
 *
 * Counts the readable text in a server-returned HTML document. The rules are
 * documented in docs/word.md and mirrored here so they stay next to the code.
 *
 * Parsing uses htmlparser2, a real (spec-oriented, streaming) HTML parser that
 * runs identically on Node and on the Cloudflare Workers runtime, so local
 * fixtures and production produce the same numbers.
 */

import { Parser } from "htmlparser2";

/** Element subtrees whose text is markup or code, never readable page copy. */
const SKIPPED_ELEMENTS = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "audio",
  "video",
  "iframe",
  "object",
  "embed",
  "head",
  "title",
  "meta",
  "link",
  "base",
  "select",
  "option",
  "datalist",
]);

/**
 * Inline (phrasing) elements that do not introduce a word boundary — the
 * browser renders `<b>foo</b>bar` as one word, so we must too. Every other
 * element boundary is treated as whitespace, which keeps `<p>a</p><p>b</p>`
 * from collapsing into "ab".
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

/** Unicode whitespace, including the non-breaking space `&nbsp;` decodes to. */
const WHITESPACE_PATTERN = new RegExp(
  "[\\s\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+",
  "gu",
);

function isHiddenByAttributes(attributes: Record<string, string>): boolean {
  if ("hidden" in attributes) return true;
  if (attributes["aria-hidden"]?.trim().toLowerCase() === "true") return true;

  const style = attributes.style?.toLowerCase();
  if (!style) return false;

  return (
    /display\s*:\s*none/.test(style) ||
    /visibility\s*:\s*hidden/.test(style) ||
    /content-visibility\s*:\s*hidden/.test(style)
  );
}

/**
 * Pull the readable text out of an HTML document.
 *
 * Returns whitespace-normalised text: every run of whitespace becomes a single
 * space, and the result is trimmed.
 */
export function extractReadableText(html: string): string {
  const pieces: string[] = [];

  /** Depth of nested elements we are currently skipping. 0 means "collecting". */
  let skipDepth = 0;
  /** Tag names stacked while skipping, so we only unwind on the matching close. */
  const skipStack: string[] = [];

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        const tag = name.toLowerCase();

        if (skipDepth > 0) {
          skipStack.push(tag);
          skipDepth += 1;
          return;
        }

        if (SKIPPED_ELEMENTS.has(tag) || isHiddenByAttributes(attributes)) {
          skipStack.push(tag);
          skipDepth = 1;
          return;
        }

        if (!INLINE_ELEMENTS.has(tag)) pieces.push(" ");
      },
      onclosetag(name) {
        const tag = name.toLowerCase();

        if (skipDepth > 0) {
          // Unwind only when the close tag matches what we stacked; htmlparser2
          // already repairs mismatched markup before calling us.
          const top = skipStack[skipStack.length - 1];
          if (top === tag) {
            skipStack.pop();
            skipDepth -= 1;
          }
          return;
        }

        if (!INLINE_ELEMENTS.has(tag)) pieces.push(" ");
      },
      ontext(text) {
        if (skipDepth > 0) return;
        pieces.push(text);
      },
    },
    // htmlparser2 decodes HTML entities for us and repairs implied structure.
    { decodeEntities: true, recognizeSelfClosing: true },
  );

  parser.write(html);
  parser.end();

  return pieces.join("").replace(WHITESPACE_PATTERN, " ").trim();
}

/**
 * The word token.
 *
 * A word is a run of letters and/or numbers, which may carry internal
 * apostrophes or hyphens: "don't", "state-of-the-art" and "1,521" tokenise the
 * way a reader would expect ("1,521" is two tokens, since a comma is not an
 * internal joiner). Punctuation, symbols and standalone separators are not
 * words.
 *
 * This is the same expression used to verify the historical benchmark
 * (see ./benchmark.ts and scripts/verify-benchmark.mjs), deliberately shared so
 * the two numbers on the result screen are always produced by one rule. Do not
 * change it without bumping COUNTING_RULE_VERSION and re-verifying the
 * benchmark.
 */
const WORD_TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Count words in already-normalised text. */
export function countWords(normalizedText: string): number {
  return normalizedText.match(WORD_TOKEN)?.length ?? 0;
}

/** Characters, counted as Unicode code points, spaces included. */
export function countCharacters(normalizedText: string): number {
  return Array.from(normalizedText).length;
}

export type CountResult = {
  words: number;
  characters: number;
  /** True when the document had no extractable readable text at all. */
  empty: boolean;
};

/** Parse HTML and count it. The only entry point callers need. */
export function countHtml(html: string): CountResult {
  const text = extractReadableText(html);
  const words = countWords(text);

  return {
    words,
    characters: countCharacters(text),
    empty: words === 0,
  };
}
