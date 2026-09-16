// Cloudflare Workers can't dynamically compile WASM, so the default
// `@prisma/client` entrypoint (which resolves to the binary query engine
// outside a `workerd` bundler condition) fails at runtime. Importing the
// generated wasm build directly sidesteps that condition-resolution gap.
import { PrismaClient } from "@prisma/client/wasm.js";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let cached: PrismaClient | undefined;

export async function getDb(): Promise<PrismaClient> {
  if (cached) return cached;
  const { env } = await getCloudflareContext({ async: true });
  const adapter = new PrismaD1(env.DB);
  cached = new PrismaClient({ adapter });
  return cached;
}
