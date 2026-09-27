/**
 * The official "A BlindspotLab Product" badge.
 *
 * This is the supplied embed code, transcribed to JSX with its inline styles
 * intact — deliberately self-contained so it can be updated or dropped in one
 * place without touching Word's own styling. Don't restyle it here; swap the
 * whole file if the official embed changes.
 */
export function BlindspotLabBadge() {
  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%", margin: "0 0 24px" }}>
      <a
        href="https://blindspotlab.xyz"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          minHeight: "44px",
          color: "#5E635F",
          fontFamily:
            "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          fontSize: "14px",
          fontWeight: 400,
          lineHeight: 1.5,
          textDecoration: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- official embed: fixed-size external SVG, served by blindspotlab.xyz */}
        <img
          src="https://blindspotlab.xyz/brand/avatar-forest.svg"
          alt=""
          width={24}
          height={24}
          style={{
            display: "block",
            width: "24px",
            height: "24px",
            flexShrink: 0,
            borderRadius: "50%",
          }}
        />
        <span>A BlindspotLab Product</span>
      </a>
    </div>
  );
}
