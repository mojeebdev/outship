// Every /api/v1 request goes through here: an optional key, rate limits, CORS
// and metering. Keyless requests are welcome but limited per IP; a key gets
// its own (higher) limit and its usage is counted per day for the admin KPIs.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { clientIdentifier, consumeRateLimit } from "@/lib/rate-limit";
import { bearerKey, hashApiKey } from "./keys";

export const ANONYMOUS_LIMITS = [
  { name: "minute", windowSeconds: 60, max: 30 },
  { name: "day", windowSeconds: 86_400, max: 1_000 },
] as const;

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

export function apiError(status: number, error: string, headers: HeadersInit = {}) {
  return Response.json({ error }, { status, headers: { ...CORS_HEADERS, ...headers } });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

type Handler = (request: Request) => Promise<Response>;

/** Wraps a GET handler with key checks, limits, metering and CORS. */
export function apiRoute(handler: Handler): Handler {
  return async (request) => {
    const key = bearerKey(request.headers.get("authorization"));
    if (key === "invalid") return apiError(401, "malformed API key: expected Authorization: Bearer os_live_…");

    const db = await getDb();
    let keyId = "anonymous";
    let verdict;
    if (key) {
      const record = await db.apiKey.findUnique({ where: { hash: await hashApiKey(key) } });
      if (!record || record.revokedAt) return apiError(401, "unknown or revoked API key");
      keyId = record.id;
      verdict = await consumeRateLimit(record.id, "api-key", [
        { name: "minute", windowSeconds: 60, max: record.ratePerMinute },
      ]);
    } else {
      verdict = await consumeRateLimit(clientIdentifier(request), "api-anon", ANONYMOUS_LIMITS);
    }
    if (!verdict.allowed) {
      return apiError(429, key ? "rate limit reached for this key" : "rate limit reached; use an API key for more", {
        "Retry-After": String(verdict.retryAfterSeconds ?? 60),
      });
    }

    // Metering stays off the response path.
    const { ctx, env } = await getCloudflareContext({ async: true });
    const day = new Date().toISOString().slice(0, 10);
    ctx.waitUntil(
      env.DB.batch([
        env.DB.prepare(
          `INSERT INTO "ApiUsage" ("keyId", "day", "count") VALUES (?1, ?2, 1)
             ON CONFLICT("keyId", "day") DO UPDATE SET "count" = "count" + 1`,
        ).bind(keyId, day),
        ...(keyId === "anonymous"
          ? []
          : [env.DB.prepare(`UPDATE "ApiKey" SET "lastUsedAt" = ?2 WHERE "id" = ?1`).bind(keyId, new Date().toISOString())]),
      ]).catch(() => undefined),
    );

    const response = await handler(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  };
}
