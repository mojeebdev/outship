import { prefersMarkdown } from "./ai-agents";
import { canonicalUrlFor, htmlPathForMarkdownUrl, htmlToMarkdown, isMarkdownPage, markdownUrlFor } from "./markdown-pages";

type Render = (request: Request) => Promise<Response>;

function isNoindex(response: Response): boolean {
  return /noindex/i.test(response.headers.get("x-robots-tag") ?? "");
}

/**
 * Serve the Markdown version of a key public page (docs/ai-recommendation-playbook.md, step 2), or return null to
 * let the request continue as normal.
 *
 * - `GET /<path>.md` for a key page → Markdown (404 if the page is not public).
 * - `GET /<path>` with `Accept: text/markdown` → Markdown at the same URL.
 *
 * The page is rendered once without cookies or credentials, so the Markdown is always the public HTML's content and
 * never anything personal. A non-200, non-HTML or noindex page is never converted.
 */
export async function serveMarkdown(request: Request, render: Render): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const aliasPath = htmlPathForMarkdownUrl(url.pathname, url.host);
  const negotiated = !aliasPath && isMarkdownPage(url.pathname, url.host) && prefersMarkdown(request.headers.get("accept"));
  if (!aliasPath && !negotiated) return null;

  const htmlPath = aliasPath ?? url.pathname;
  const htmlUrl = new URL(htmlPath, url);
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  headers.set("accept", "text/html");
  const page = await render(new Request(htmlUrl, { method: "GET", headers }));

  const isHtml = (page.headers.get("content-type") ?? "").includes("text/html");
  if (page.status !== 200 || !isHtml || isNoindex(page)) {
    // A negotiated request falls back to the normal page; a .md alias has nothing to serve.
    return negotiated ? null : new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const canonical = canonicalUrlFor(htmlPath, url.host);
  const markdown = htmlToMarkdown(await page.text(), canonical);
  return new Response(request.method === "HEAD" ? null : markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      // The HTML page stays the canonical URL for search engines.
      Link: `<${canonical}>; rel="canonical"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * On key HTML pages, advertise the Markdown version: `Vary: Accept` (the same URL can answer in two formats) and
 * `<link rel="alternate" type="text/markdown">` in the head (via HTMLRewriter, available in the Workers runtime).
 */
export function advertiseMarkdown(request: Request, response: Response): Response {
  const url = new URL(request.url);
  if (request.method !== "GET" || !isMarkdownPage(url.pathname, url.host)) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html") || response.status !== 200 || isNoindex(response)) {
    return response;
  }
  const withVary = new Response(response.body, response);
  withVary.headers.append("Vary", "Accept");
  const Rewriter = (globalThis as { HTMLRewriter?: new () => HtmlRewriterLike }).HTMLRewriter;
  if (!Rewriter) return withVary;
  const href = markdownUrlFor(url.pathname);
  return new Rewriter()
    .on("head", {
      element(head: { append(content: string, options: { html: boolean }): void }) {
        head.append(`<link rel="alternate" type="text/markdown" href="${href}">`, { html: true });
      },
    })
    .transform(withVary);
}

type HtmlRewriterLike = {
  on(selector: string, handlers: { element(element: { append(content: string, options: { html: boolean }): void }): void }): HtmlRewriterLike;
  transform(response: Response): Response;
};
