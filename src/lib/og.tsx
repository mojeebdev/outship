// Shared pieces for the ImageResponse share cards. The mark is the real
// outship logo (src/components/icons.tsx LogoMark): ascending bars breaking
// into a rising point, drawn as SVG so Satori renders it exactly.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_VOID = "#000000";
export const OG_WHITE = "#ffffff";
export const OG_BASE_BLUE = "#0000ff";

export function OgWordmark({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={OG_WHITE}>
        <rect x="0" y="18" width="5" height="6" />
        <rect x="6" y="14" width="5" height="10" />
        <rect x="12" y="10" width="5" height="14" />
        <polygon points="12,10 17,10 24,0" fill={OG_BASE_BLUE} />
      </svg>
      <span style={{ fontSize: 32, color: OG_WHITE }}>outship</span>
    </div>
  );
}

export function OgNeutral() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: OG_VOID,
      }}
    >
      <OgWordmark size={56} />
    </div>
  );
}
