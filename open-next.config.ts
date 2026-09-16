import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import kvTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";

// Route the Next.js page/route cache to R2 (the "R2 object/file storage"
// piece of the stack) instead of the default per-isolate in-memory cache,
// and tag-based revalidation bookkeeping to KV.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: kvTagCache,
});
