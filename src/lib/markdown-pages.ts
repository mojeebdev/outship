import { parse } from "node-html-parser";
import { NodeHtmlMarkdown } from "node-html-markdown";

/**
 * Markdown for agents (docs/ai-recommendation-playbook.md, step 2).
 *
 * Key public pages (Outship, public profiles and Word) are also available as Markdown: at `<path>.md`, or at the page's own URL when the request's
 * Accept header asks for text/markdown. The Markdown is converted from the same HTML a person gets (rendered
 * without cookies, so it is always the public version), so its content is identical. It is never bot-only.
 * Private, authenticated and noindex pages are never converted.
 */

const EXACT_PAGES = new Set([
  "/",
  "/leaderboard",
  "/streaks",
  "/builders",
  "/stats",
  "/about",
  "/manifesto",
  "/faq",
  "/developers",
  "/changelog",
  "/privacy",
  "/terms",
  "/for-ai",
]);

const HANDLE = "@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})";
const PATTERN_PAGES = [
  // Public profiles and their public-only Shipmarks (the same data the HTML shows; never stored snapshots).
  new RegExp(`^/${HANDLE}$`),
  new RegExp(`^/${HANDLE}/shipmarks(?:/(?:firsts|daily|weekly|monthly|streaks))?$`),
];

const WORD_HOST = "word.outship.dev";
// word.outship.dev serves Word from its root; every page there is public writing.
const WORD_PAGE = /^\/(?:[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*)?$/;

function isWordHost(host?: string | null): boolean {
  return (host ?? "").toLowerCase().replace(/:\d+$/, "") === WORD_HOST;
}

/** Is this HTML path, on this host, one of the key public pages that has a Markdown version? */
export function isMarkdownPage(pathname: string, host?: string | null): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (isWordHost(host)) return WORD_PAGE.test(path) && !path.startsWith("/api");
  return EXACT_PAGES.has(path) || PATTERN_PAGES.some((pattern) => pattern.test(path));
}

/** `/registry.md` → `/registry`; `/index.md` → `/`. Null when the URL is not a Markdown alias of a key page. */
export function htmlPathForMarkdownUrl(pathname: string, host?: string | null): string | null {
  if (!pathname.endsWith(".md")) return null;
  const base = pathname.slice(0, -3);
  const htmlPath = base === "/index" || base === "" ? "/" : base;
  return isMarkdownPage(htmlPath, host) ? htmlPath : null;
}

/** The canonical HTML URL a Markdown version points back to. */
export function canonicalUrlFor(htmlPath: string, host?: string | null): string {
  const origin = isWordHost(host) ? "https://word.outship.dev" : "https://outship.dev";
  return htmlPath === "/" ? `${origin}/` : `${origin}${htmlPath}`;
}

/** The `.md` URL advertised for an HTML page (`/` → `/index.md`). */
export function markdownUrlFor(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return path === "/" ? "/index.md" : `${path}.md`;
}

const REMOVED = "script,style,noscript,svg,template,iframe,nav,form,button,dialog,[hidden],[aria-hidden=true]";
/** Only when there is no <main>: the site header and footer are chrome, not content. */
const REMOVED_WITHOUT_MAIN = "header,footer";

const converter = new NodeHtmlMarkdown({ bulletMarker: "-", maxConsecutiveNewlines: 2, keepDataImages: false });

/**
 * Convert a rendered page to Markdown: front matter (title, canonical URL, description) followed by the page's
 * main content. Site chrome (navigation, header, footer, forms, scripts) is dropped; the content itself is kept as is.
 */
export function htmlToMarkdown(html: string, canonicalUrl: string): string {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const title = root.querySelector("title")?.text.trim() ?? "";
  const description = root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? "";
  const mainElement = root.querySelector("main");
  const main = mainElement ?? root.querySelector("body") ?? root;
  for (const node of main.querySelectorAll(REMOVED)) node.remove();
  if (!mainElement) for (const node of main.querySelectorAll(REMOVED_WITHOUT_MAIN)) node.remove();
  const body = converter.translate(main.innerHTML).trim();

  const frontMatter = ["---", `title: ${JSON.stringify(title)}`, `url: ${canonicalUrl}`];
  if (description) frontMatter.push(`description: ${JSON.stringify(description)}`);
  frontMatter.push("---");
  return `${frontMatter.join("\n")}\n\n${body}\n`;
}
