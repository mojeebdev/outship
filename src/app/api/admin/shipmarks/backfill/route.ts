import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { isAdminLogin } from "@/lib/admin-logins";
import { backfillShipmarks } from "@/lib/shipmarks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const builder = await getCurrentBuilder();
  const { env } = await getCloudflareContext({ async: true });
  if (!builder || !isAdminLogin(builder.githubLogin, env.ADMIN_GITHUB_LOGINS)) return new Response("not found", { status: 404 });
  if (new URL(request.url).searchParams.get("dryRun") === "1") {
    const [builders, ships, existing] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS n FROM "Builder"').first<{ n: number }>(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM "Ship"').first<{ n: number }>(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM "Shipmark"').first<{ n: number }>()
    ]);
    return Response.json({ dryRun: true, builders: builders?.n ?? 0, ships: ships?.n ?? 0, existingShipmarks: existing?.n ?? 0, note: "No writes or emails sent." });
  }
  const result = await backfillShipmarks(env.DB);
  return Response.json({ dryRun: false, ...result, note: "Historical achievements created. No emails sent." });
}
