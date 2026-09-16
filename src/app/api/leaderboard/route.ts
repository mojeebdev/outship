import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();

  const builders = await db.builder.findMany({
    orderBy: { score: "desc" },
    take: 50,
    select: {
      githubLogin: true,
      score: true,
      currentStreak: true,
      longestStreak: true,
      _count: { select: { ships: true } },
    },
  });

  return Response.json({ builders });
}
