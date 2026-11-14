import { getDb } from "@/lib/db";
import { getCurrentBuilder } from "@/lib/auth/current-builder";

export const dynamic = "force-dynamic";

// The installer's switch for the one-time claim comment in their repos. Only
// the builder whose own installation it is can change it: installationId is
// set at sign-in from GitHub's answer to "which installations can this user
// see", never from a URL.
export async function POST(request: Request) {
  const builder = await getCurrentBuilder();
  if (builder?.installationId) {
    const form = await request.formData().catch(() => null);
    const choice = form?.get("invites");
    if (choice === "on" || choice === "off") {
      await (await getDb()).installation.updateMany({
        where: { id: builder.installationId },
        data: { claimInvitesEnabled: choice === "on" },
      });
    }
  }
  return Response.redirect(new URL("/profile", request.url), 303);
}
