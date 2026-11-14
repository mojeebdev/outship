import { getDb } from "@/lib/db";
import { getCurrentBuilder } from "@/lib/auth/current-builder";

export const dynamic = "force-dynamic";

// "hide my profile" on /profile. Hidden builders vanish from every public page
// (their /@handle 404s) while their ships keep counting privately. Like the
// recap switch, it relies on the SameSite=Lax session cookie: a form posted
// from another site arrives without it and changes nothing.
export async function POST(request: Request) {
  const builder = await getCurrentBuilder();
  if (builder) {
    const form = await request.formData().catch(() => null);
    const choice = form?.get("hidden");
    if (choice === "on" || choice === "off") {
      await (await getDb()).builder.update({ where: { id: builder.id }, data: { hidden: choice === "on" } });
    }
  }
  return Response.redirect(new URL("/profile", request.url), 303);
}
