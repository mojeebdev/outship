/**
 * AI crawler, assistant and agent detection (docs/ai-recommendation-playbook.md, step 1).
 *
 * Classifies a request by its User-Agent (and the Web Bot Auth `Signature-Agent` header some agents send) into:
 * - training:  crawls to build model training sets
 * - search:    indexes pages for a search or AI-answer product (includes Googlebot/Bingbot/Applebot, which also feed
 *              AI Overviews, Copilot and Apple Intelligence)
 * - assistant: fetches a page in real time because a person asked an assistant about it
 * - agent:     an autonomous or coding agent acting for a person
 *
 * Detection is best-effort. Some AI fetchers present as ordinary browsers (e.g. DeepSeek has been seen as an old
 * Chrome) and cannot be told apart from people by headers alone; they are simply not counted.
 * Nothing here reads or stores personal data: only the agent name, category, path, status and format.
 */

export type AiAgentCategory = "training" | "search" | "assistant" | "agent";

export type AiAgent = {
  name: string;
  operator: string;
  category: AiAgentCategory;
};

type Rule = { pattern: RegExp } & AiAgent;

// Order matters: the first match wins, so specific tokens come before broader ones.
const RULES: readonly Rule[] = [
  // OpenAI
  { pattern: /OAI-SearchBot/i, name: "OAI-SearchBot", operator: "OpenAI", category: "search" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT-User", operator: "OpenAI", category: "assistant" },
  { pattern: /GPTBot/i, name: "GPTBot", operator: "OpenAI", category: "training" },
  // Anthropic
  { pattern: /Claude-SearchBot/i, name: "Claude-SearchBot", operator: "Anthropic", category: "search" },
  { pattern: /Claude-User/i, name: "Claude-User", operator: "Anthropic", category: "assistant" },
  { pattern: /claude-code/i, name: "Claude Code", operator: "Anthropic", category: "agent" },
  { pattern: /ClaudeBot|anthropic-ai/i, name: "ClaudeBot", operator: "Anthropic", category: "training" },
  // Perplexity
  { pattern: /Perplexity-User/i, name: "Perplexity-User", operator: "Perplexity", category: "assistant" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot", operator: "Perplexity", category: "search" },
  // Google, Microsoft, Apple (search crawlers that also ground AI answers)
  { pattern: /Google-NotebookLM/i, name: "Google-NotebookLM", operator: "Google", category: "assistant" },
  { pattern: /GoogleOther/i, name: "GoogleOther", operator: "Google", category: "training" },
  { pattern: /Googlebot/i, name: "Googlebot", operator: "Google", category: "search" },
  { pattern: /bingbot/i, name: "Bingbot", operator: "Microsoft", category: "search" },
  { pattern: /Applebot/i, name: "Applebot", operator: "Apple", category: "search" },
  { pattern: /DuckAssistBot/i, name: "DuckAssistBot", operator: "DuckDuckGo", category: "assistant" },
  // Meta, Amazon, Mistral, Common Crawl, ByteDance, Cohere and others
  { pattern: /meta-externalfetcher/i, name: "Meta-ExternalFetcher", operator: "Meta", category: "assistant" },
  { pattern: /meta-externalagent/i, name: "Meta-ExternalAgent", operator: "Meta", category: "training" },
  { pattern: /MistralAI-User/i, name: "MistralAI-User", operator: "Mistral", category: "assistant" },
  { pattern: /Amazonbot/i, name: "Amazonbot", operator: "Amazon", category: "training" },
  { pattern: /CCBot/i, name: "CCBot", operator: "Common Crawl", category: "training" },
  { pattern: /Bytespider/i, name: "Bytespider", operator: "ByteDance", category: "training" },
  { pattern: /cohere-ai|cohere-training-data-crawler/i, name: "Cohere", operator: "Cohere", category: "training" },
  { pattern: /YouBot/i, name: "YouBot", operator: "You.com", category: "search" },
  // Coding and autonomous agents that identify themselves
  { pattern: /\bopencode\b/i, name: "OpenCode", operator: "OpenCode", category: "agent" },
  { pattern: /\bcursor\b/i, name: "Cursor", operator: "Anysphere", category: "agent" },
  { pattern: /\bcodex\b/i, name: "Codex", operator: "OpenAI", category: "agent" },
];

/** Classify a request. Returns null for anything that is not a recognised AI or search agent. */
export function classifyAiAgent(userAgent: string | null | undefined, signatureAgent?: string | null): AiAgent | null {
  const ua = (userAgent ?? "").slice(0, 512);
  for (const rule of RULES) {
    if (rule.pattern.test(ua)) return { name: rule.name, operator: rule.operator, category: rule.category };
  }
  // Web Bot Auth: signed agent requests carry Signature-Agent, e.g. "https://chatgpt.com".
  const signer = (signatureAgent ?? "").replace(/^"|"$/g, "").trim();
  if (signer) {
    let host = signer;
    try { host = new URL(signer).hostname; } catch { /* keep the raw value */ }
    return { name: `Signed agent (${host.slice(0, 60)})`, operator: host.slice(0, 60), category: "agent" };
  }
  return null;
}

export type ServedFormat = "markdown" | "html" | "json" | "text" | "xml" | "other";

/** What format the response actually carried, from its Content-Type. */
export function servedFormat(contentType: string | null | undefined): ServedFormat {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/markdown")) return "markdown";
  if (type.includes("text/html")) return "html";
  if (type.includes("json")) return "json";
  if (type.includes("xml")) return "xml";
  if (type.includes("text/plain")) return "text";
  return "other";
}

/** Did the client ask for Markdown (Accept: text/markdown)? */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  return /(^|,|\s)text\/markdown(\s*;|\s*,|\s*$)/i.test(accept ?? "");
}

// Never log these: private, authenticated, one-time or tracking routes, and static build assets.
const UNLOGGED_PREFIXES = ["/api/", "/admin", "/profile", "/invite", "/token/claim", "/_next/"];

/** The path to record: pathname only (never the query string), or null when the route must not be logged. */
export function loggablePath(pathname: string): string | null {
  if (UNLOGGED_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix))) {
    return null;
  }
  return pathname.slice(0, 200);
}
