// The climb: a winding path up a hill to a tower that is the outship mark
// (ascending bars breaking into a point), under a Base-blue sky. The waypoints
// on the path are the real tiers (src/lib/tiers.ts), from deckhand at the
// bottom to admiral at the tower, so the picture says what the tiers are.
// An original drawing, server-rendered SVG, no images.
import { TIERS } from "@/lib/tiers";

// Where each tier sits on the path, bottom to top. Six tiers, six stops.
const STOPS = [
  { x: 120, y: 291 },
  { x: 330, y: 262 },
  { x: 505, y: 232 },
  { x: 665, y: 207 },
  { x: 785, y: 189 },
  { x: 888, y: 172 },
] as const;

const SKY = "var(--color-base-blue)";
const CREAM = "var(--color-cream)";
const VOID = "var(--color-void)";

function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} style={{ fill: "#ffffff" }}>
      <circle cx="0" cy="0" r="26" />
      <circle cx="30" cy="-12" r="32" />
      <circle cx="66" cy="-4" r="26" />
      <circle cx="92" cy="8" r="18" />
      <rect x="-26" y="0" width="136" height="26" rx="13" />
    </g>
  );
}

export function ClimbScene() {
  const tiers = TIERS.slice(0, STOPS.length);
  return (
    <svg
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMaxYMax slice"
      // Phones crop to the summit end (the last three stops); wider screens
      // scale the whole scene.
      className="block h-48 w-full sm:h-auto"
      role="img"
      aria-label={`the climb: tiers by all-time score, from ${tiers[0].name} to ${tiers[tiers.length - 1].name}`}
    >
      <rect width="1200" height="300" style={{ fill: SKY }} />

      {/* a towering cloud on the left, small ones on the horizon */}
      <g style={{ fill: "#ffffff" }}>
        <circle cx="150" cy="150" r="54" />
        <circle cx="205" cy="118" r="62" />
        <circle cx="160" cy="88" r="48" />
        <circle cx="215" cy="62" r="40" />
        <circle cx="255" cy="150" r="44" />
        <rect x="96" y="150" width="210" height="60" rx="30" />
      </g>
      <Cloud x={1040} y={168} scale={0.6} />
      <Cloud x={1110} y={122} scale={0.5} />
      <Cloud x={430} y={98} scale={0.45} />

      {/* far hills */}
      <path
        d="M0 252 C 140 228 260 238 380 226 C 520 212 600 214 700 205 C 820 194 960 200 1200 186 L1200 300 L0 300 Z"
        style={{ fill: "color-mix(in srgb, var(--color-base-blue) 72%, white)" }}
      />

      {/* the hill */}
      <path
        d="M0 300 L0 262 C 200 252 380 240 520 222 C 650 205 760 184 860 174 C 930 168 1010 170 1070 184 C 1130 196 1170 210 1200 214 L1200 300 Z"
        style={{ fill: CREAM }}
      />
      {/* engraving strokes on the slope */}
      <g style={{ stroke: VOID, opacity: 0.14 }} strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M560 250 l40 -6 M620 262 l52 -8 M700 240 l46 -8 M760 262 l60 -9 M940 214 l40 4 M1010 238 l48 6 M1080 222 l40 6" />
        <path d="M200 282 l36 -3 M260 292 l44 -4 M420 270 l40 -5 M880 250 l44 -2" />
      </g>

      {/* the tower: the outship mark, on the summit */}
      <g transform="translate(902 26) scale(6)">
        <rect x="0" y="18" width="5" height="6" style={{ fill: VOID }} />
        <rect x="6" y="14" width="5" height="10" style={{ fill: VOID }} />
        <rect x="12" y="10" width="5" height="14" style={{ fill: VOID }} />
        <polygon points="12,10 17,10 24,0" style={{ fill: "#ffffff" }} />
      </g>

      {/* the path up */}
      <path
        d="M40 298 C 160 296 230 276 330 262 C 430 248 420 240 505 232 C 600 223 600 212 665 207 C 735 201 740 194 785 189 C 830 184 850 176 888 172"
        fill="none"
        strokeLinecap="round"
        style={{ stroke: VOID }}
        strokeWidth="11"
      />
      <path
        d="M40 298 C 160 296 230 276 330 262 C 430 248 420 240 505 232 C 600 223 600 212 665 207 C 735 201 740 194 785 189 C 830 184 850 176 888 172"
        fill="none"
        strokeLinecap="round"
        style={{ stroke: "#ffffff" }}
        strokeWidth="6"
      />

      {/* the tiers, as stops on the way up */}
      {tiers.map((tier, i) => {
        const stop = STOPS[i];
        const last = i === tiers.length - 1;
        return (
          <g key={tier.name}>
            <circle cx={stop.x} cy={stop.y} r={last ? 7 : 6} style={{ fill: last ? SKY : VOID, stroke: "#ffffff" }} strokeWidth="2.5" />
            {/* A cream halo keeps each label legible over the sky and the path. */}
            <text
              x={last ? stop.x - 12 : stop.x}
              y={last ? stop.y - 14 : stop.y - 20}
              textAnchor={last ? "end" : "middle"}
              fontSize="15"
              fontWeight={last ? 600 : 500}
              strokeWidth="5"
              strokeLinejoin="round"
              style={{ fill: VOID, stroke: CREAM, paintOrder: "stroke" }}
            >
              {tier.name}
            </text>
          </g>
        );
      })}

      {/* flowers in the foreground */}
      <g style={{ fill: VOID, opacity: 0.35 }}>
        {[
          [70, 280], [190, 288], [240, 276], [380, 284], [450, 270], [560, 288], [610, 256], [720, 282],
          [930, 262], [990, 284], [1050, 256], [1130, 276], [1170, 246], [300, 294], [840, 272],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" />
        ))}
      </g>
    </svg>
  );
}
