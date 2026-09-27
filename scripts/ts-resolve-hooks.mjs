/**
 * Module resolution hooks for `npm run test:word`.
 *
 * Node's built-in test runner strips TypeScript types but still uses strict ESM
 * resolution, so it can't follow this codebase's extensionless relative imports
 * or its `@/*` path alias. These hooks teach it both, which keeps the app code
 * written the way the rest of the repo is written.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx", ".js"];

export async function resolve(specifier, context, nextResolve) {
  let request = specifier;

  // `@/lib/...` -> `<root>/src/lib/...`, matching tsconfig's paths mapping.
  if (request.startsWith("@/")) {
    request = pathToFileURL(path.join(projectRoot, "src", request.slice(2))).href;
  }

  try {
    return await nextResolve(request, context);
  } catch (error) {
    if (!request.startsWith(".") && !request.startsWith("file:")) throw error;

    const base = new URL(request, context.parentURL);
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }

    throw error;
  }
}
