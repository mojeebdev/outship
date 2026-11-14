// Who appears where. Hidden builders never appear on a public page (their
// profile 404s); unclaimed builders (never signed in) appear, labelled, but
// only claimed builders take a rank.
import type { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

/** Prisma filter for any public list of builders. */
export const PUBLIC_BUILDER = { hidden: false } as const;

/** Prisma filter for builders who hold a rank. */
export const RANKED_BUILDER = { hidden: false, claimedAt: { not: null } } as const;

export function isClaimed(builder: { claimedAt: Date | null }): boolean {
  return builder.claimedAt !== null;
}

/** GitHub serves every account's avatar by numeric id, no API call needed. */
export function avatarUrl(githubId: number, size = 96): string {
  return `https://avatars.githubusercontent.com/u/${githubId}?s=${size}&v=4`;
}

/** Resolve a `/@handle` route segment to a builder, or null. */
export async function builderForHandle(db: Db, rawHandle: string) {
  // The dynamic segment can arrive percent-encoded (e.g. "%40mojeebdev")
  // depending on the runtime, rather than pre-decoded like plain Next.js.
  let handle: string;
  try {
    handle = decodeURIComponent(rawHandle);
  } catch {
    return null;
  }
  if (!handle.startsWith("@")) return null;
  const githubLogin = handle.slice(1);
  if (!githubLogin) return null;
  return db.builder.findUnique({ where: { githubLogin } });
}
