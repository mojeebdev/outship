import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { ProfilePageHeading } from "@/components/profile-page-heading";
import { ShipmarkCollection, type Shipmark } from "@/components/shipmark-collection";

export const metadata: Metadata = { title: "Shipmarks · profile — outship" };
export const dynamic = "force-dynamic";

export default async function ProfileShipmarksPage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  const { env } = await getCloudflareContext({ async: true });
  await env.DB.prepare(
    'INSERT OR IGNORE INTO "Shipmark" ("id","builderId","code","period","earnedAt","snapshot","source") ' +
    'SELECT lower(hex(randomblob(16))),b."id",\'welcome-aboard\',substr(b."createdAt",1,10),b."createdAt", ' +
    'json_object(\'joinedAt\',b."createdAt",\'ships\',(SELECT COUNT(*) FROM "Ship" s WHERE s."builderId"=b."id" AND s."shippedAt"<=b."createdAt"),' +
    '\'commits\',(SELECT COUNT(DISTINCT s."commitSha") FROM "Ship" s WHERE s."builderId"=b."id" AND s."shippedAt"<=b."createdAt"),\'merges\',(SELECT COUNT(*) FROM "Ship" s WHERE s."builderId"=b."id" AND s."shipType"=\'MERGE\' AND s."shippedAt"<=b."createdAt")),\'BACKFILL\' ' +
    'FROM "Builder" b WHERE b."id"=?1',
  ).bind(builder.id).run();
  const rows = await env.DB.prepare('SELECT "id","code","period","earnedAt","snapshot" FROM "Shipmark" WHERE "builderId" = ?1 ORDER BY "earnedAt" DESC LIMIT 80').bind(builder.id).all<Shipmark>();
  const marks = (rows.results ?? []).map((mark) => ({ ...mark, earnedAt: String(mark.earnedAt), snapshot: String(mark.snapshot) }));
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="milestones" title="your Shipmarks" description="Collectible records for showing up, shipping, and building momentum." />
      <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <ShipmarkCollection marks={marks} />
      </section>
    </div>
  );
}
