/**
 * Word — per-IP rate limiting. The fixed-window counter itself is shared with
 * the rest of the app in `@/lib/rate-limit`; this keeps Word's default limits.
 */

import { RATE_LIMITS } from "./constants";
import { consumeRateLimit as consume, type RateLimit } from "@/lib/rate-limit";

export { clientIdentifier, type RateLimitVerdict } from "@/lib/rate-limit";

export function consumeRateLimit(
  identifier: string,
  scope: string,
  limits: readonly RateLimit[] = RATE_LIMITS,
) {
  return consume(identifier, scope, limits);
}
