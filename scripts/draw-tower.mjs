// Draws the home page art: the outship tower as a fine-line engraving,
// bleeding off the left edge, with a low ruined arcade running along the
// bottom and one band of the drawing washed in outship blue. Writes three crops
// to public/scene/, for src/components/hero.tsx and the footer:
//
//   tower-wide.svg    landscape screens: behind the hero's centred copy
//   tower-tall.svg    portrait screens: under the hero's copy
//   tower-arcade.svg  the arcade alone, along the bottom of the footer
//
// Generated rather than hand-drawn because an engraving is thousands of
// strokes (stone courses, hatching); a seeded random generator places the
// irregular ones, so rerunning gives the same files byte for byte.
//
//   node scripts/draw-tower.mjs
//
// Every stroke is drawn once, in currentColor, inside <defs>; the file then
// shows it twice: in ink, and in blue clipped to the wash band. That keeps
// the files small and the two colours in register.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "scene");

// outship's colours (src/app/globals.css)
const INK = "#000000";
const BLUE = "#0000ff";
const BLUE_TINT = "#e6e6ff";

// The world is 1600 x 1060. The tower's front face spans x = -60..240 and its
// shaded side to 350; the arcade runs from 360 to the right edge.
const CROPS = {
  wide: { viewBox: [-60, 0, 1660, 1060] },
  tall: { viewBox: [-60, 140, 940, 920] },
  arcade: { viewBox: [360, 760, 1280, 300] },
};

function rng(seed) {
  // mulberry32: deterministic, so the drawing never changes between runs
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

// Strokes are bucketed by weight, so the whole drawing is a handful of paths.
const WEIGHTS = {
  outline: { width: 1.6, opacity: 1 },
  edge: { width: 1.1, opacity: 1 },
  fine: { width: 0.55, opacity: 0.45 },
  hatch: { width: 0.5, opacity: 0.7 },
  shade: { width: 0.45, opacity: 0.35 },
};
function strokes() {
  const buckets = Object.fromEntries(Object.keys(WEIGHTS).map((key) => [key, []]));
  const add = (weight, d) => buckets[weight].push(d);
  const render = (clipFor = {}) =>
    Object.entries(buckets)
      .filter(([, list]) => list.length > 0)
      .map(([key, list]) => {
        const { width, opacity } = WEIGHTS[key];
        const clip = clipFor[key] ? ` clip-path="url(#${clipFor[key]})"` : "";
        return `<path d="${list.join(" ")}" stroke-width="${width}" opacity="${opacity}"${clip}/>`;
      })
      .join("");
  return { add, render };
}

// A round-headed arch from `bottom` up, `width` wide, its springing at `spring`.
const arch = (x, spring, width, bottom) =>
  `M${f(x)} ${f(bottom)} V${f(spring)} A ${f(width / 2)} ${f(width / 2)} 0 0 1 ${f(x + width)} ${f(spring)} V${f(bottom)}`;

// Vertical hatching inside an arch, the dark of its opening.
function archHatch(add, x, spring, width, bottom, step) {
  const r = width / 2;
  for (let hx = x + step; hx < x + width; hx += step) {
    const dx = hx - x - r;
    add("hatch", `M${f(hx)} ${f(spring - Math.sqrt(Math.max(0, r * r - dx * dx)) + 1.5)} V${f(bottom)}`);
  }
}

function tower(add) {
  const r = rng(5);
  const X = -60;
  const W = 300;
  const S = 110; // depth of the shaded side
  const TOP = 70;
  const BOT = 1060;
  const slope = 26; // how far the side's top edge drops toward the back

  add("outline", `M${X} ${BOT} V${TOP} H${X + W} V${BOT}`);
  add("outline", `M${X + W} ${TOP} L${X + W + S} ${TOP + slope} V${BOT}`);
  for (const y of [TOP, TOP + 14, TOP + 120, TOP + 134]) {
    add("edge", `M${X - 8} ${y} H${X + W + 4} L${X + W + S + 4} ${y + slope}`);
  }

  // stone courses on the front, joints staggered row to row
  for (let y = TOP + 150, row = 0; y < BOT; y += 16, row++) {
    add("fine", `M${X} ${y} H${X + W}`);
    for (let x = X + (row % 2 ? 18 : 0); x < X + W; x += 36) add("fine", `M${f(x + r() * 3)} ${y} V${y + 16}`);
  }
  // courses on the side, following its perspective
  for (let y = TOP + 150; y < BOT; y += 16) add("fine", `M${X + W} ${y} L${X + W + S} ${f(y + slope * 0.6)}`);
  // diagonal shading on the side face only (clipped to it in the output)
  for (let k = -12; k < 30; k++) {
    const x0 = X + W + k * 9;
    add("shade", `M${x0} ${TOP} L${x0 + 160} ${TOP + 1000}`);
  }

  // the arcade under the top cornice
  const cell = (W - 20) / 6;
  for (let i = 0; i < 6; i++) {
    const ax = X + 10 + i * cell + 5;
    const aw = cell - 10;
    const spring = TOP + 34 + aw / 2;
    add("edge", arch(ax, spring, aw, TOP + 112));
    archHatch(add, ax, spring, aw, TOP + 112, 2.4);
  }

  // the great arch, with its voussoirs
  const gx = X + 90;
  const gw = 120;
  const gSpring = TOP + 250 + gw / 2;
  add("edge", arch(gx, gSpring, gw, BOT));
  add("edge", arch(gx - 10, gSpring, gw + 20, BOT));
  for (let a = 0; a <= 12; a++) {
    const t = Math.PI - (a / 12) * Math.PI;
    const cx = gx + gw / 2;
    add(
      "edge",
      `M${f(cx + (Math.cos(t) * gw) / 2)} ${f(gSpring - (Math.sin(t) * gw) / 2)} L${f(cx + Math.cos(t) * (gw / 2 + 10))} ${f(gSpring - Math.sin(t) * (gw / 2 + 10))}`,
    );
  }
  archHatch(add, gx, gSpring, gw, BOT, 2.2);

  // a slit window on the side
  add("edge", `M${X + W + 45} ${TOP + 330} V${TOP + 700} M${X + W + 65} ${TOP + 336} V${TOP + 700}`);
  for (let y = TOP + 334; y < TOP + 700; y += 2.5) add("hatch", `M${X + W + 46} ${f(y)} H${X + W + 64}`);

  return { sideFace: `M${X + W} ${TOP} L${X + W + S} ${TOP + slope} V${BOT} H${X + W} Z`, markAt: [X + W / 2 - 30, TOP + 160] };
}

// The low ruined arcade along the bottom, settling lower toward the right.
function ruins(add) {
  const r = rng(9);
  const START = 360;
  const END = 1640;
  const BASE = 1060;
  const top = (x) => 820 + (x - START) * 0.06 + Math.sin(x / 37) * 6;

  const edge = [];
  for (let x = START; x <= END; x += 14) edge.push(`${x} ${f(top(x) + (r() - 0.5) * 10)}`);
  add("outline", `M${START} ${BASE} V${f(top(START))} L${edge.join(" L")}`);
  for (let y = 840; y < BASE; y += 14) {
    // courses stop at the ragged top
    for (let x = START; x < END; x += 14) if (top(x) + 6 < y) add("fine", `M${x} ${y} H${x + 14}`);
  }
  for (let x = START + 40; x < END - 20; x += 130) {
    const w = 80;
    const spring = top(x) + 50 + w / 2;
    add("edge", arch(x, spring, w, BASE));
    archHatch(add, x, spring, w, BASE, 2.4);
  }
  // a little timber scaffold on the ruin: still being built
  add("edge", "M1080 760 V830 M1140 770 V832 M1070 778 H1150 M1070 800 H1150");
}

function drawing() {
  const { add, render } = strokes();
  const { sideFace, markAt } = tower(add);
  ruins(add);
  const mark = `<g transform="translate(${markAt[0]} ${markAt[1]}) scale(2.5)" stroke-width="0.5"><rect x="0" y="18" width="5" height="6"/><rect x="6" y="14" width="5" height="10"/><rect x="12" y="10" width="5" height="14"/><polygon points="12,10 17,10 24,0"/></g>`;
  return `<defs>
  <clipPath id="side"><path d="${sideFace}"/></clipPath>
  <clipPath id="band"><rect x="-100" y="430" width="460" height="330"/><rect x="360" y="760" width="520" height="300"/></clipPath>
  <g id="art" fill="none" stroke="currentColor" stroke-linecap="round">${render({ shade: "side" })}${mark}</g>
</defs>
<g clip-path="url(#band)"><rect x="-100" y="0" width="1800" height="1100" fill="${BLUE_TINT}"/></g>
<use href="#art" color="${INK}"/>
<use href="#art" color="${BLUE}" clip-path="url(#band)"/>`;
}

mkdirSync(OUT, { recursive: true });
const body = drawing();
for (const [name, { viewBox }] of Object.entries(CROPS)) {
  const [, , w, h] = viewBox;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(" ")}" width="${w}" height="${h}">${body}</svg>\n`;
  writeFileSync(join(OUT, `tower-${name}.svg`), svg);
  console.log(`public/scene/tower-${name}.svg  ${(svg.length / 1024).toFixed(0)} KB`);
}
