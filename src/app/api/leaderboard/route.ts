import { getDb } from "@/lib/db";
import { PUBLIC_BUILDER } from "@/lib/builders";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();

  const builders = await db.builder.findMany({
    where: PUBLIC_BUILDER,
    orderBy: { score: "desc" },
    take: 50,
    select: {
      githubLogin: true,
      score: true,
      currentStreak: true,
      longestStreak: true,
      claimedAt: true,
      _count: { select: { ships: true } },
    },
  });

  return Response.json({
    builders: builders.map(({ claimedAt, ...builder }) => ({ ...builder, claimed: claimedAt !== null })),
  });
}
