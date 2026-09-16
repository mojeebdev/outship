import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";

export const alt = "outship builder profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const VOID = "#000000";
const WHITE = "#ffffff";
const BASE_BLUE = "#0000ff";

async function loadBuilder(rawHandle: string) {
  const handle = decodeURIComponent(rawHandle);
  if (!handle.startsWith("@")) return null;
  const githubLogin = handle.slice(1);
  if (!githubLogin) return null;

  const db = await getDb();
  return db.builder.findUnique({ where: { githubLogin } });
}

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

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", width: 12, height: 12, background: BASE_BLUE }} />
        <span style={{ fontSize: 56, color: WHITE }}>{value}</span>
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
  const builder = await loadBuilder(handle);

  if (!builder) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: VOID,
          }}
        >
          <Wordmark />
        </div>
      ),
      size,
    );
  }

  const db = await getDb();
  const rankAbove = await db.builder.count({ where: { score: { gt: builder.score } } });

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

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 96, color: WHITE }}>{builder.githubLogin}</span>
          <div style={{ display: "flex", gap: 64 }}>
            <Stat value={builder.currentStreak} label="streak" />
            <Stat value={builder.score} label="score" />
            <Stat value={`#${rankAbove + 1}`} label="rank" />
            <Stat value="on base" label="attested" />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
