import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { allTimeRank, builderForHandle } from "@/lib/builders";
import { OG_BASE_BLUE, OG_SIZE, OG_VOID, OG_WHITE, OgNeutral, OgWordmark } from "@/lib/og";

export const alt = "outship builder profile";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", width: 12, height: 12, background: OG_BASE_BLUE }} />
        <span style={{ fontSize: 56, color: OG_WHITE }}>{value}</span>
      </div>
      <span style={{ fontSize: 22, color: "rgba(255,255,255,0.5)" }}>{label}</span>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const db = await getDb();
  const builder = await builderForHandle(db, handle);

  // Unknown and hidden handles get the same plain card, so a card can't
  // reveal that a hidden profile exists.
  if (!builder || builder.hidden) return new ImageResponse(<OgNeutral />, size);

  const [rank, ships] = await Promise.all([
    allTimeRank(db, builder),
    db.ship.count({ where: { builderId: builder.id } }),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG_VOID,
          padding: 72,
        }}
      >
        <OgWordmark />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 96, color: OG_WHITE }}>{builder.githubLogin}</span>
          <div style={{ display: "flex", gap: 64 }}>
            <Stat value={builder.currentStreak} label="streak" />
            <Stat value={builder.score} label="score" />
            <Stat value={rank ? `#${rank}` : "unclaimed"} label="rank" />
            <Stat value={ships} label="ships" />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
