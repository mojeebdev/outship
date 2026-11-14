// The share card for each leaderboard tab. Each tab is its own route
// (/leaderboard, /leaderboard/month, /leaderboard/all) because an
// opengraph-image only sees route params, never the query string.
import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";
import { PERIOD_LABELS, loadLeaderboard, type Period } from "@/lib/leaderboard";
import { OG_BASE_BLUE, OG_SIZE, OG_VOID, OG_WHITE, OgWordmark } from "@/lib/og";

export async function leaderboardImage(period: Period) {
  const board = await loadLeaderboard(await getDb(), { period });
  const top = board.rows.filter((row) => row.rank !== null).slice(0, 5);

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
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span style={{ fontSize: 56, color: OG_WHITE }}>the leaderboard · {PERIOD_LABELS[period]}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {top.length === 0 ? (
              <span style={{ fontSize: 28, color: "rgba(255,255,255,0.5)" }}>the board is open: be the first to ship</span>
            ) : (
              top.map((row) => (
                <div key={row.githubLogin} style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <span style={{ width: 48, fontSize: 32, color: "rgba(255,255,255,0.4)" }}>#{row.rank}</span>
                  <span style={{ flex: 1, fontSize: 36, color: OG_WHITE }}>{row.githubLogin}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", width: 12, height: 12, background: OG_BASE_BLUE }} />
                    <span style={{ fontSize: 32, color: OG_WHITE }}>{row.score}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
