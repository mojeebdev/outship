import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";

export const alt = "outship leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const VOID = "#000000";
const WHITE = "#ffffff";
const BASE_BLUE = "#0000ff";

function Wordmark() {
  const bars = [
    { height: 16, color: WHITE },
    { height: 26, color: WHITE },
    { height: 36, color: BASE_BLUE },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
        {bars.map((bar, index) => (
          <div
            key={index}
            style={{ width: 8, height: bar.height, background: bar.color }}
          />
        ))}
      </div>
      <span style={{ fontSize: 32, color: WHITE }}>outship</span>
    </div>
  );
}

export default async function Image() {
  const db = await getDb();
  const builders = await db.builder.findMany({
    orderBy: { score: "desc" },
    take: 5,
    select: { githubLogin: true, score: true },
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: VOID,
          padding: 72,
        }}
      >
        <Wordmark />

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span style={{ fontSize: 56, color: WHITE }}>the leaderboard</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {builders.length === 0 ? (
              <span style={{ fontSize: 28, color: "rgba(255,255,255,0.5)" }}>
                be the first to ship
              </span>
            ) : (
              builders.map((builder, index) => (
                <div
                  key={builder.githubLogin}
                  style={{ display: "flex", alignItems: "center", gap: 24 }}
                >
                  <span
                    style={{
                      width: 48,
                      fontSize: 32,
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    #{index + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: 36, color: WHITE }}>
                    {builder.githubLogin}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", width: 12, height: 12, background: BASE_BLUE }} />
                    <span style={{ fontSize: 32, color: WHITE }}>{builder.score}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
