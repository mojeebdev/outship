import { getDb } from "@/lib/db";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { setBuilderRecap } from "@/lib/email/subscribers";

export const dynamic = "force-dynamic";

// The recap switch on /profile. The session cookie is SameSite=Lax, so a form
// posted from another site arrives without it and is turned away here.
export async function POST(request: Request) {
  const builder = await getCurrentBuilder();
  if (!builder?.email) {
    return Response.redirect(new URL("/profile", request.url), 303);
  }
  const form = await request.formData().catch(() => null);
  const choice = form?.get("recap");
  if (choice === "on" || choice === "off") {
    await setBuilderRecap(await getDb(), builder.email, choice === "on");
  }
  return Response.redirect(new URL("/profile", request.url), 303);
}
