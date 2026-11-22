import { classifyAiAgent, loggablePath, prefersMarkdown, servedFormat } from "./ai-agents";

/** Workers Analytics Engine dataset binding (wrangler.jsonc: analytics_engine_datasets → AI_AGENT_EVENTS). */
type AnalyticsEngineDataset = {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
};

export type AiAgentLogEnv = { AI_AGENT_EVENTS?: AnalyticsEngineDataset };

/**
 * Record one AI crawler/assistant/agent request (docs/ai-recommendation-playbook.md, step 1).
 *
 * Written after the response is ready, so status and format are what the agent actually got. Only the agent name,
 * operator, category, path (no query string), format, host and status are stored. No IP address, cookies or
 * query parameters. People's requests are never recorded. A missing binding or a write error never affects the
 * response.
 *
 * Analytics Engine columns: blob1 agent · blob2 operator · blob3 category · blob4 path · blob5 format ·
 * blob6 host · blob7 "accept-markdown" when the client asked for Markdown · double1 status · index1 category.
 */
export function logAiAgentRequest(request: Request, response: Response, env: AiAgentLogEnv): void {
  try {
    const dataset = env.AI_AGENT_EVENTS;
    if (!dataset) return;
    const agent = classifyAiAgent(request.headers.get("user-agent"), request.headers.get("signature-agent"));
    if (!agent) return;
    const url = new URL(request.url);
    const path = loggablePath(url.pathname);
    if (!path) return;
    dataset.writeDataPoint({
      blobs: [
        agent.name,
        agent.operator,
        agent.category,
        path,
        servedFormat(response.headers.get("content-type")),
        url.hostname.slice(0, 100),
        prefersMarkdown(request.headers.get("accept")) ? "accept-markdown" : "",
      ],
      doubles: [response.status],
      indexes: [agent.category],
    });
  } catch {
    // Logging is best-effort and must never break a page.
  }
}
