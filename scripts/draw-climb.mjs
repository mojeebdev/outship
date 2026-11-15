// Draws the home page hero scene: a stone tower on a crag under a big cloud,
// with a path winding up to it through a field. Writes three crops of the same
// drawing to public/scene/, one per layout in src/components/hero.tsx:
//
//   climb-wide.svg  desktop: the copy sits in the sky to the left of the tower
//   climb-mid.svg   tablet:  the scene sits under the copy
//   climb-tall.svg  phone:   the scene sits under the copy
//
// The drawing is generated rather than hand-edited because the field (grass
// strokes, flowers, bushes) is thousands of marks placed by a seeded random
// generator; rerunning this script gives the same files byte for byte.
//
//   node scripts/draw-climb.mjs
//
// Colours are outship's own (src/app/globals.css) and tints of the blue.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "scene");

const BLUE = "#0000ff";
const BLACK = "#000000";
const WHITE = "#ffffff";
const CREAM = "#f5f5f0";
const BLUE_TINT = "#e6e6ff";
// tints of the blue, for the shaded and distant parts of the scene
const CLOUD_SHADE = "#d4d4ff";
const SEA = "#5c5cff";
const FAR_FIELD = "#d4d4fb";
const STONE_SHADE = "#d9d9d0";

// Each crop is a window onto one 1600 x 1000 world. The ground and sea run
// wider than that so wide windows never run out of world.
const CROPS = {
  wide: { viewBox: [-330, 0, 2030, 1000] },
  mid: { viewBox: [380, 40, 1320, 970] },
  tall: { viewBox: [760, 70, 900, 940] },
};
const X_MIN = -400;
const X_MAX = 1800;
// Marks outside the crop being written are dropped (after drawing them from
// the random generator, so every crop still shows the same field).
let visible = () => true;
const HORIZON = 664;

function rng(seed) {
  // mulberry32: tiny and deterministic, so the drawing never changes between runs
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

// ---- the path -------------------------------------------------------------

const PATH_POINTS = [
  [1105, 704], [1050, 712], [1000, 722], [1030, 736], [1130, 752], [1185, 772],
  [1150, 798], [1050, 830], [1000, 868], [1030, 915], [1110, 965], [1160, 1012],
];

function catmullRom(points, steps = 24) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
const CENTER = catmullRom(PATH_POINTS);
// Perspective: the path is a thread at the foot of the crag and wide at your feet.
const pathWidth = (y) => 4 + Math.pow(Math.max(0, (y - 700) / 310), 1.5) * 100;

function pathOutline() {
  const left = [];
  const right = [];
  for (let i = 0; i < CENTER.length; i++) {
    const a = CENTER[Math.max(i - 1, 0)];
    const b = CENTER[Math.min(i + 1, CENTER.length - 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = pathWidth(CENTER[i][1]) / 2;
    left.push([CENTER[i][0] - dy * w, CENTER[i][1] + dx * w]);
    right.push([CENTER[i][0] + dy * w, CENTER[i][1] - dx * w]);
  }
  return [...left, ...right.reverse()].map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
}

function onPath(x, y, pad) {
  for (const [cx, cy] of CENTER) {
    if (Math.abs(cy - y) < 12 && Math.abs(cx - x) < pathWidth(cy) / 2 + pad) return true;
  }
  return false;
}

// ---- sky ------------------------------------------------------------------

function defs() {
  return `<defs>
  <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="5" stroke="${BLACK}" stroke-width="1.1" opacity=".55"/></pattern>
  <pattern id="hatch-cloud" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><line x1="0" y1="0" x2="0" y2="5" stroke="${BLUE}" stroke-width="1" opacity=".35"/></pattern>
  <pattern id="stones" width="24" height="14" patternUnits="userSpaceOnUse"><path d="M0 13.5 H24 M0 6.5 H24 M8 0 V6.5 M20 7 V13.5" stroke="${BLACK}" stroke-width=".8" opacity=".35" fill="none"/></pattern>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.2 .62"/></filter>
</defs>`;
}

// A cloud is a union of puffs: the shade fills the union, then each puff is
// drawn again a little up and to the left in white, leaving a shaded rim on
// the lower right like an engraving.
function cloud(id, puffs, flatBase) {
  const xs = puffs.map((p) => p[0]);
  const base = flatBase
    ? `<rect x="${f(Math.min(...xs) - 8)}" y="${f(flatBase - 12)}" width="${f(Math.max(...xs) - Math.min(...xs) + 16)}" height="16" rx="8"/>`
    : "";
  const union = puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("") + base;
  const lit = puffs.map(([x, y, r]) => `<circle cx="${f(x - r * 0.16)}" cy="${f(y - r * 0.2)}" r="${f(r * 0.9)}"/>`).join("");
  const rims = puffs.map(([x, y, r]) => `M${f(x - r * 0.95)} ${f(y + r * 0.1)} A ${r} ${r} 0 0 0 ${f(x + r * 0.7)} ${f(y + r * 0.72)}`).join(" ");
  return `<clipPath id="${id}">${union}</clipPath>
  <g clip-path="url(#${id})">
    <rect x="${X_MIN}" y="0" width="${X_MAX - X_MIN}" height="${HORIZON + 20}" fill="${CLOUD_SHADE}"/>
    <rect x="${X_MIN}" y="0" width="${X_MAX - X_MIN}" height="${HORIZON + 20}" fill="url(#hatch-cloud)"/>
    <g fill="${WHITE}">${lit}${base}</g>
    <path d="${rims}" fill="none" stroke="${BLUE}" stroke-width="1" opacity=".16"/>
  </g>`;
}

// A towering cumulus: a broad base billowing up into a cauliflower head. The
// puffs on the rim are smaller, so the edge reads as many lobes.
function bigCloud(cx, base) {
  const r = rng(7);
  const puffs = [];
  const height = 460;
  const half = (t) => (t < 0.55 ? 147 + t * 59 : 179 - (t - 0.55) * 294);
  for (let i = 0; i < 170; i++) {
    const t = Math.pow(r(), 0.9);
    const u = r() * 2 - 1;
    const hw = Math.max(20, half(t));
    const x = cx + t * 39 + u * hw * 0.92;
    const y = base - t * height;
    const rad = (Math.abs(u) > 0.75 ? 12 + r() * 14 : 26 + r() * 26) * (1 - t * 0.25);
    puffs.push([f(x), f(y), f(rad)]);
  }
  for (let k = 0; k < 9; k++) puffs.push([f(cx - 147 + k * 36), f(base - 6), 23.5]);
  return cloud("cloud-big", puffs);
}

// A low bank of cloud on the horizon.
function cloudBank(id, x, y, w) {
  const r = rng(x + 1);
  const puffs = [];
  const n = Math.round(w / 26);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hump = Math.sin(t * Math.PI);
    puffs.push([f(x + t * w), f(y - hump * 12 - r() * 6), f(10 + hump * 12 + r() * 6)]);
  }
  return cloud(id, puffs, y + 2);
}

// ---- the tower and its rock ----------------------------------------------

// A tall stone tower: a row of arches at the top, the outship mark carved
// beneath them, one great arch through the middle, and its side in shadow.
function tower(x, y, w, h) {
  const side = w * 0.32;
  const archW = w * 0.42;
  const archTop = y + 118;
  const archBottom = y + h - 8;
  const ax = x + (w - archW) / 2;
  const cell = (w - 20) / 6;
  const arcade = Array.from({ length: 6 }, (_, i) => {
    const cx = x + 10 + i * cell + 2.5;
    const cw = cell - 5;
    return `<path d="M${f(cx)} ${y + 46} V${f(y + 26 + cw / 2)} A ${f(cw / 2)} ${f(cw / 2)} 0 0 1 ${f(cx + cw)} ${f(y + 26 + cw / 2)} V${y + 46} Z"/>`;
  }).join("");
  const sideFace = `M${x + w} ${y + 6} L${x + w + side} ${y + 14} V${y + h + 6} L${x + w} ${y + h} Z`;
  const arch = (inset) => `M${f(ax - inset)} ${archBottom} V${f(archTop + archW / 2)} A ${f(archW / 2 + inset)} ${f(archW / 2 + inset)} 0 0 1 ${f(ax + archW + inset)} ${f(archTop + archW / 2)} V${archBottom}`;
  return `<g>
    <path d="${sideFace}" fill="${STONE_SHADE}"/>
    <path d="${sideFace}" fill="url(#hatch)" opacity=".7"/>
    <path d="M${f(x + w + side * 0.3)} ${f(archTop + 30)} V${archBottom} H${f(x + w + side * 0.7)} V${f(archTop + 34)} Z" fill="${BLACK}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${CREAM}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#stones)"/>
    <rect x="${x - 3}" y="${y}" width="${w + 3}" height="10" fill="${CREAM}" stroke="${BLACK}" stroke-width="1"/>
    <rect x="${x - 3}" y="${y + 52}" width="${w + 3}" height="7" fill="${CREAM}" stroke="${BLACK}" stroke-width="1"/>
    <g fill="${BLACK}">${arcade}</g>
    <rect x="${x + w - 16}" y="${y + 60}" width="16" height="${h - 60}" fill="url(#hatch)" opacity=".35"/>
    <path d="${arch(0)} Z" fill="${BLACK}"/>
    <path d="${arch(6)}" fill="none" stroke="${BLACK}" stroke-width="2"/>
    <rect x="${f(ax + archW - 9)}" y="${f(archTop + archW / 2 + 10)}" width="5" height="${f(archBottom - archTop - archW / 2 - 20)}" fill="${BLUE}"/>
    <g transform="translate(${f(x + w / 2 - 18)} ${y + 70}) scale(1.5)" fill="${BLACK}">
      <rect x="0" y="18" width="5" height="6"/><rect x="6" y="14" width="5" height="10"/><rect x="12" y="10" width="5" height="14"/><polygon points="12,10 17,10 24,0"/>
    </g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${BLACK}" stroke-width="1.6"/>
  </g>`;
}

// The rock under the tower: a slope with a town at its foot on the left,
// walls wrapping up its face, and a sheer cliff in shadow on the right.
function crag(cx, top) {
  const r = rng(11);
  const X = (dx) => cx + dx;
  const rock = `M${X(-230)} 712 C ${X(-190)} 694 ${X(-160)} 676 ${X(-135)} 652 L ${X(-118)} 622 L ${X(-104)} 596 L ${X(-98)} 566 L ${X(-84)} ${top + 14} L ${X(-70)} ${top} H ${X(105)} L ${X(122)} ${top + 16} L ${X(136)} ${top + 44} C ${X(150)} 610 ${X(180)} 650 ${X(225)} 680 L ${X(265)} 712 Z`;
  const cliff = `M${X(70)} ${top} H ${X(105)} L ${X(122)} ${top + 16} L ${X(136)} ${top + 44} C ${X(150)} 610 ${X(180)} 650 ${X(225)} 680 L ${X(265)} 712 H ${X(140)} C ${X(120)} 660 ${X(100)} 620 ${X(90)} 590 Z`;
  const cracks = Array.from({ length: 26 }, () => {
    const x = X(-100 + r() * 330);
    const y = top + 20 + r() * 160;
    return `M${f(x)} ${f(y)} l${f((r() - 0.5) * 6)} ${f(8 + r() * 16)}`;
  }).join(" ");
  const wall = (x1, y1, qx, qy, x2, y2, t) => `<path d="M${X(x1)} ${y1} Q ${X(qx)} ${qy} ${X(x2)} ${y2} L ${X(x2)} ${y2 + t} Q ${X(qx)} ${qy + t} ${X(x1)} ${y1 + t} Z" fill="${CREAM}" stroke="${BLACK}" stroke-width="1"/>
    <path d="M${X(x1)} ${y1 + t * 0.5} Q ${X(qx)} ${qy + t * 0.5} ${X(x2)} ${y2 + t * 0.5}" stroke="${BLACK}" stroke-width="3.5" stroke-dasharray="1.2 3.5" opacity=".55" fill="none"/>`;
  const shrubs = [];
  for (let i = 0; i < 40; i++) {
    const gx = X(-190 + r() * 330);
    const gy = top + 30 + r() * 170;
    if (gx > X(80) && gy < 640) continue;
    for (let k = 0; k < 4; k++) shrubs.push(`<circle cx="${f(gx + (r() - 0.5) * 22)}" cy="${f(gy + (r() - 0.5) * 8)}" r="${f(2.5 + r() * 4)}"/>`);
  }
  const houses = [];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9 - row * 2; i++) {
      const x = X(-215 + row * 22 + i * 16 + r() * 5);
      const y = 700 - row * 16 - i * 1.5 + r() * 4;
      houses.push(`<rect x="${f(x)}" y="${f(y)}" width="12" height="8" fill="${WHITE}" stroke="${BLACK}" stroke-width=".6"/><path d="M${f(x - 1)} ${f(y)} L ${f(x + 6)} ${f(y - 4.5)} L ${f(x + 13)} ${f(y)} Z" fill="${BLUE}"/>`);
    }
  }
  return `<path d="${rock}" fill="${CREAM}"/>
  <path d="${rock}" fill="url(#hatch)" opacity=".18"/>
  <path d="${cliff}" fill="${STONE_SHADE}"/>
  <path d="${cliff}" fill="url(#hatch)" opacity=".6"/>
  <path d="${cracks}" stroke="${BLACK}" stroke-width="1.2" opacity=".45"/>
  ${wall(-150, 664, 0, 640, 150, 618, 9)}
  ${wall(-112, 612, 0, 590, 132, 572, 8)}
  ${wall(-96, 568, 0, 556, 122, 548, 7)}
  <g fill="${BLUE}" opacity=".7">${shrubs.join("")}</g>
  ${houses.join("")}`;
}

// ---- the field ------------------------------------------------------------

function field() {
  const r = rng(21);
  const grass = [];
  for (let i = 0; i < 1800; i++) {
    const y = 700 + Math.pow(r(), 0.8) * 300;
    const x = X_MIN + r() * (X_MAX - X_MIN);
    if (onPath(x, y, 2) || !visible(x)) continue;
    const len = 2 + ((y - 700) / 300) * 9;
    grass.push(`M${f(x)} ${f(y)} l${f((r() - 0.5) * 2)} ${f(-len)}`);
  }
  // rows of trees across the middle distance, broken where the crag stands
  const t = rng(51);
  const trees = [];
  for (const [x0, x1, y, rad] of [[X_MIN, 905, 744, 3], [1300, X_MAX, 742, 3], [X_MIN, 880, 792, 4.5], [1380, X_MAX, 794, 4.5]]) {
    for (let x = x0; x < x1; x += rad * 1.3) {
      if (t() < 0.25) continue;
      const tree = `<circle cx="${f(x)}" cy="${f(y + (t() - 0.5) * 3)}" r="${f(rad * (0.7 + t() * 0.6))}"/>`;
      if (visible(x)) trees.push(tree);
    }
  }
  return `<rect x="${X_MIN}" y="690" width="${X_MAX - X_MIN}" height="330" fill="${BLUE_TINT}"/>
  <rect x="${X_MIN}" y="690" width="${X_MAX - X_MIN}" height="40" fill="${FAR_FIELD}"/>
  <g fill="${BLUE}" opacity=".55">${trees.join("")}</g>
  <path d="${grass.join(" ")}" stroke="${BLUE}" stroke-width="1.1" opacity=".4" fill="none"/>`;
}

function ponds() {
  const pond = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 6}" ry="${ry + 4}" fill="${CREAM}" stroke="${BLACK}" stroke-width="1"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${BLUE}"/>
    <path d="M${cx - rx * 0.6} ${cy - ry * 0.2} h${rx * 0.5} M${cx - rx * 0.1} ${cy + ry * 0.3} h${rx * 0.6}" stroke="${WHITE}" stroke-width="1.5" opacity=".7"/>`;
  return pond(760, 852, 120, 17) + pond(1390, 846, 130, 18);
}

function bushes() {
  const r = rng(31);
  const out = [];
  for (const [cx, cy, w] of [[640, 832, 70], [890, 872, 55], [600, 900, 80], [1270, 870, 120], [1520, 868, 70], [1250, 820, 30], [430, 820, 40]]) {
    for (let i = 0; i < w / 6; i++) {
      const x = cx - w / 2 + r() * w;
      const y = cy - r() * 18;
      if (onPath(x, y, 10)) continue;
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(7 + r() * 9)}"/>`);
    }
  }
  return `<g fill="${BLACK}">${out.join("")}</g>`;
}

// Flowers in the foreground, bigger as they come toward you.
function flowers() {
  const r = rng(41);
  const out = [];
  for (let i = 0; i < 1100; i++) {
    const y = 890 + Math.pow(r(), 0.7) * 115;
    const x = X_MIN + r() * (X_MAX - X_MIN);
    const s = (1.5 + ((y - 890) / 110) * 5) * (0.7 + r() * 0.5);
    if (onPath(x, y, 8) || !visible(x)) continue;
    out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}"/>`);
  }
  return `<g fill="${BLUE}">${out.join("")}</g>`;
}

// Someone at the bottom of the path, on their way up.
function climber() {
  const [x, y] = CENTER[Math.round((CENTER.length - 1) * 0.96)];
  return `<g transform="translate(${f(x + 14)} ${f(y + 18)})">
    <ellipse cx="6" cy="2" rx="14" ry="3" fill="${BLACK}" opacity=".2"/>
    <path d="M-3 0 L0 -20 L5 -20 L8 0" stroke="${BLACK}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="-4" y="-40" width="12" height="22" rx="4" fill="${BLACK}"/>
    <rect x="4" y="-38" width="9" height="15" rx="3" fill="${BLUE}" stroke="${BLACK}" stroke-width="1.2"/>
    <circle cx="2" cy="-46" r="5.5" fill="${BLACK}"/>
    <path d="M-8 -30 L-12 2" stroke="${BLACK}" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

// ---- the world ------------------------------------------------------------

function world() {
  return `${defs()}
  <rect x="${X_MIN}" y="-1000" width="${X_MAX - X_MIN}" height="3000" fill="${BLUE}"/>
  ${bigCloud(1480, 640)}
  ${cloudBank("cloud-bank", 1330, 640, 260)}
  <rect x="${X_MIN}" y="${HORIZON}" width="${X_MAX - X_MIN}" height="30" fill="${SEA}"/>
  <path d="M${X_MIN} 672 H${X_MAX} M${X_MIN} 682 H${X_MAX}" stroke="${WHITE}" stroke-width="1" opacity=".5" stroke-dasharray="30 14 60 20"/>
  ${field()}
  ${crag(1160, 530)}
  <rect x="1080" y="522" width="210" height="14" fill="${CREAM}" stroke="${BLACK}" stroke-width="1.2"/>
  <path d="M1084 529 H1286" stroke="${BLACK}" stroke-width="5" stroke-dasharray="1.5 4" opacity=".6"/>
  ${tower(1088, 96, 150, 432)}
  ${ponds()}
  ${bushes()}
  <polygon points="${pathOutline()}" fill="${CREAM}" stroke="${BLACK}" stroke-width="1.5"/>
  ${flowers()}
  ${climber()}
  <rect x="${X_MIN}" y="${HORIZON}" width="${X_MAX - X_MIN}" height="400" filter="url(#grain)" opacity=".3"/>`;
}

mkdirSync(OUT, { recursive: true });
for (const [name, { viewBox }] of Object.entries(CROPS)) {
  const [x0, , w, h] = viewBox;
  visible = (x) => x > x0 - 20 && x < x0 + w + 20;
  const body = world();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(" ")}" width="${w}" height="${h}">${body}</svg>\n`;
  writeFileSync(join(OUT, `climb-${name}.svg`), svg);
  console.log(`public/scene/climb-${name}.svg  ${(svg.length / 1024).toFixed(0)} KB`);
}
