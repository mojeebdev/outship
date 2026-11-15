// The README badge at /@handle/badge.svg: a small card with the real outship
// mark, the login, all-time score, current streak, rank, and where the
// numbers come from. Pure string building, so it's tested directly.

import { tierFor } from "./tiers";

export const BADGE_WIDTH = 380;
export const BADGE_HEIGHT = 96;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const VOID = "#000000";
const BLUE = "#0000ff";
const MUTED = "#666666";
const BORDER = "#e0e0e0";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The outship logo mark (src/components/icons.tsx LogoMark), at 24 units square. */
function mark(x: number, y: number, size: number): string {
  const scale = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect x="0" y="18" width="5" height="6" fill="${VOID}"/>
    <rect x="6" y="14" width="5" height="10" fill="${VOID}"/>
    <rect x="12" y="10" width="5" height="14" fill="${VOID}"/>
    <polygon points="12,10 17,10 24,0" fill="${BLUE}"/>
  </g>`;
}

function frame(title: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <clipPath id="card"><rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="8"/></clipPath>
  <g clip-path="url(#card)" font-family="${FONT}">
    <rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" fill="#ffffff"/>
    <rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="7.5" fill="none" stroke="${BORDER}"/>
    ${mark(20, 22, 28)}
    ${body}
  </g>
</svg>`;
}

export function renderBadge({
  login,
  score,
  streak,
  rank,
}: {
  login: string;
  score: number;
  streak: number;
  rank: number | null;
}): string {
  const rankText = rank ? `#${rank}` : "unranked";
  const tier = tierFor(score).tier.name;
  const title = `${login} on outship: ${tier}, score ${score}, ${streak}-day streak, rank ${rankText}. verified on github.`;
  const stat = (x: number, value: string, label: string) =>
    `<text x="${x}" y="60" font-size="17" font-weight="600" fill="${VOID}">${escapeXml(value)}</text>
    <text x="${x}" y="76" font-size="11" fill="${MUTED}">${label}</text>`;
  return frame(
    title,
    // Long logins (GitHub allows 39 characters) are squeezed to fit, not cut.
    `<text x="62" y="34" font-size="16" font-weight="600" fill="${VOID}"${login.length > 24 ? ' textLength="190" lengthAdjust="spacingAndGlyphs"' : ""}>${escapeXml(login)}</text>
    ${stat(62, String(score), "score")}
    ${stat(142, `${streak}d`, "streak")}
    ${stat(222, rankText, "rank")}
    <text x="${BADGE_WIDTH - 18}" y="34" font-size="11" fill="${BLUE}" text-anchor="end">verified on github</text>
    <text x="${BADGE_WIDTH - 18}" y="60" font-size="13" font-weight="600" fill="${VOID}" text-anchor="end">${escapeXml(tier)}</text>
    <text x="${BADGE_WIDTH - 18}" y="76" font-size="11" fill="${MUTED}" text-anchor="end">outship.dev</text>`,
  );
}

/** Unknown and hidden handles get the same card, so it can't reveal which. */
export function renderNotFoundBadge(): string {
  return frame(
    "outship: profile not found",
    `<text x="62" y="44" font-size="16" font-weight="600" fill="${VOID}">outship</text>
    <text x="62" y="64" font-size="12" fill="${MUTED}">profile not found</text>`,
  );
}
