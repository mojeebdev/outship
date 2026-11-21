import { getDb } from "@/lib/db";
import { currentAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Revokes an API key at once; requests with it get 401 from then on.
export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return new Response("not found", { status: 404 });
  const form = await request.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  if (id) {
    await (await getDb()).apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  return Response.redirect(new URL("/admin/platform", request.url), 303);
}
