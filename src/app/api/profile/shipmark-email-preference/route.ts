import { getDb } from "@/lib/db";
import { getCurrentBuilder } from "@/lib/auth/current-builder";

export const dynamic = "force-dynamic";

// The session cookie is SameSite=Lax, so a cross-site form post has no session.
export async function POST(request: Request) {
  const builder = await getCurrentBuilder();
  if (!builder?.email) {
    return Response.redirect(new URL("/profile", request.url), 303);
  }

  const form = await request.formData().catch(() => null);
  const choice = form?.get("shipmarks");
  if (choice === "on" || choice === "off") {
    const db = await getDb();
    await db.builder.update({
      where: { id: builder.id },
      data: { shipmarkEmailsEnabled: choice === "on" },
    });
  }

  return Response.redirect(new URL("/profile/settings", request.url), 303);
}
