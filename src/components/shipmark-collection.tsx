"use client";

import { useId, useState } from "react";

export type Shipmark = { id: string; code: string; period: string; earnedAt: string; snapshot: string };

type BadgeKind = "anchor" | "ship" | "signal" | "flame" | "orbit" | "three" | "seven" | "fourteen" | "thirty" | "hundred";
type BadgeStyle = { title: string; subtitle: string; kind: BadgeKind; metal: "silver" | "blue" | "gold" };

const styles: Record<string, BadgeStyle> = {
  "welcome-aboard": { title: "Welcome Aboard", subtitle: "Your Outship journey starts here", kind: "anchor", metal: "silver" },
  "first-ship": { title: "First Ship", subtitle: "Your first verified ship", kind: "ship", metal: "blue" },
  "daily-ship": { title: "Daily Shipmark", subtitle: "You showed up and shipped", kind: "signal", metal: "blue" },
  "weekly-streak": { title: "Weekly Streak", subtitle: "A week of making progress", kind: "flame", metal: "gold" },
  "monthly-challenge": { title: "Monthly Challenge", subtitle: "20 or more ships in a month", kind: "orbit", metal: "gold" },
  "streak-3": { title: "3-Day Streak", subtitle: "Three days of consistency", kind: "three", metal: "silver" },
  "streak-7": { title: "7-Day Streak", subtitle: "A full week of consistency", kind: "seven", metal: "blue" },
  "streak-14": { title: "14-Day Streak", subtitle: "Two weeks of consistency", kind: "fourteen", metal: "blue" },
  "streak-30": { title: "30-Day Streak", subtitle: "A month of consistency", kind: "thirty", metal: "gold" },
  "streak-100": { title: "100-Day Streak", subtitle: "A hundred days of showing up", kind: "hundred", metal: "silver" },
};

const metal = {
  silver: { face: "#e7edf2", edge: "#9baab7", dark: "#334155", accent: "#64748b", shine: "#ffffff" },
  blue: { face: "#dbeafe", edge: "#7d9dea", dark: "#101c35", accent: "#0000ff", shine: "#ffffff" },
  gold: { face: "#f3e5bf", edge: "#c3a76d", dark: "#3b2e19", accent: "#a88137", shine: "#fff9e9" },
} as const;

function BadgeGlyph({ kind, finish }: { kind: BadgeKind; finish: (typeof metal)[keyof typeof metal] }) {
  const gradientId = `shipmark-face-${useId().replaceAll(":", "")}`;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={finish.shine} />
          <stop offset=".55" stopColor={finish.face} />
          <stop offset="1" stopColor={finish.edge} />
        </linearGradient>
      </defs>
      <path d="M50 4 89 19v30c0 24-17 39-39 47C28 88 11 73 11 49V19L50 4Z" fill={finish.dark} />
      <path d="M50 8 85 22v27c0 21-15 35-35 43-20-8-35-22-35-43V22L50 8Z" fill={`url(#${gradientId})`} />
      <path d="M50 16 77 27v21c0 16-11 27-27 34-16-7-27-18-27-34V27l27-11Z" fill={finish.dark} />
      <path d="M50 19 74 29v19c0 14-9 23-24 30-15-7-24-16-24-30V29l24-10Z" fill="none" stroke={finish.edge} strokeWidth="1.5" />
      <g fill="none" stroke={finish.shine} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5">
        {kind === "anchor" && <><path d="M50 34v31M42 42h16M35 56c2 10 8 15 15 15s13-5 15-15M35 56l-6 1 6 7M65 56l6 1-6 7" /><circle cx="50" cy="29" r="5" /></>}
        {kind === "ship" && <><path d="M50 29v31M50 31 70 57H32l10-12M31 63h39l-6 8H38l-7-8Z" /><path d="M57 33v12" stroke={finish.accent} /></>}
        {kind === "signal" && <><path d="M31 66V54h9v12M46 66V43h9v23M61 66V31h9v35" /><path d="M29 72h43" stroke={finish.accent} /></>}
        {kind === "flame" && <path d="M51 28c3 11 14 14 14 27a15 15 0 0 1-30 0c0-8 5-13 10-20 0 8 4 10 5 11 4-6 4-11 1-18Z" />}
        {kind === "orbit" && <><circle cx="50" cy="51" r="16" /><ellipse cx="50" cy="51" rx="28" ry="11" transform="rotate(-32 50 51)" /><path d="m50 41 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z" fill={finish.accent} stroke="none" /></>}
        {kind === "three" && <><path d="M33 65V55h7v10M47 65V45h7v20M61 65V35h7v30" /><path d="M32 72h37" stroke={finish.accent} /></>}
        {kind === "seven" && <><path d="M34 37h33L47 68" /><path d="M50 25v6M50 70v6M28 51h6M66 51h6" stroke={finish.accent} /></>}
        {kind === "fourteen" && <><circle cx="50" cy="51" r="20" /><path d="M50 31v20l15 11" /><path d="M34 34 29 29M66 34l5-5" stroke={finish.accent} /></>}
        {kind === "thirty" && <><path d="M33 40c3-9 15-9 16 0 1 6-5 9-11 11 7-1 13 2 12 9-1 10-14 11-18 3M56 60l14-25M57 62h15" /><path d="M27 68c-5-4-8-9-10-15M73 68c5-4 8-9 10-15" stroke={finish.accent} /></>}
        {kind === "hundred" && <><path d="M32 43h8v20M50 53a9 10 0 1 0 18 0 9 10 0 1 0-18 0Z" /><path d="M48 33h22" stroke={finish.accent} /></>}
      </g>
      <circle cx="50" cy="18" r="2" fill={finish.shine} />
    </svg>
  );
}

function Card({ mark }: { mark: Shipmark }) {
  const [back, setBack] = useState(false);
  const badge = styles[mark.code] ?? { title: "Shipmark", subtitle: "An Outship achievement", kind: "anchor" as const, metal: "silver" as const };
  const finish = metal[badge.metal];
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(mark.snapshot) as Record<string, unknown>; } catch { /* ignore malformed legacy data */ }
  const stats = Object.entries(data).filter(([key, value]) => key !== "joinedAt" && value !== null && value !== undefined);
  const earned = new Date(mark.earnedAt);
  const date = Number.isNaN(earned.getTime()) ? mark.period : earned.toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <div className="min-w-0">
      <button type="button" onClick={() => setBack(!back)} aria-pressed={back} aria-label={`${badge.title}, ${back ? "show front" : "reveal details"}`} className="group block w-full text-left [perspective:900px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-blue focus-visible:ring-offset-2">
        <span className={`relative block aspect-[4/5] w-full rounded-xl transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d] ${back ? "[transform:rotateY(180deg)]" : ""}`}>
          <span className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-xl border border-white/15 bg-[#111827] p-4 text-white shadow-md [backface-visibility:hidden]">
            <span className="flex w-full items-center justify-between text-[9px] font-semibold uppercase tracking-[.19em] text-white/50"><span>OUTSHIP</span><span>SHIPMARK</span></span>
            <span className="relative block aspect-square w-[66%] max-w-32 drop-shadow-[0_8px_12px_rgba(0,0,0,.42)]"><BadgeGlyph kind={badge.kind} finish={finish} /></span>
            <span className="text-center"><span className="block text-sm font-semibold tracking-wide">{badge.title}</span><span className="mt-1 block text-[10px] leading-4 text-white/60">{badge.subtitle}</span></span>
            <span className="text-[9px] uppercase tracking-[.16em] text-white/45">{date}</span>
          </span>
          <span className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101e2b] p-4 text-white shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-[9px] font-semibold uppercase tracking-[.2em] text-blue-300">YOUR RECORD</span>
            <span className="mt-3 text-sm font-semibold">{badge.title}</span><span className="mt-1 text-[10px] text-white/55">{mark.period}</span>
            <span className="mt-4 flex flex-col gap-2">{stats.map(([key, value]) => <span key={key} className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 text-xs"><span className="text-white/60">{key.replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase())}</span><strong>{String(value)}</strong></span>)}
              {typeof data.joinedAt === "string" && <span className="mt-1 text-[10px] text-white/60">Joined {new Date(data.joinedAt).toLocaleString("en", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</span>}
            </span>
            <span className="mt-auto text-[9px] uppercase tracking-[.2em] text-white/45">OUTSHIP · VERIFIED ACTIVITY</span>
          </span>
        </span>
      </button>
      <span className="mt-2 block text-center text-[10px] text-text-muted-1">{back ? "tap to flip back" : "tap to reveal"}</span>
    </div>
  );
}

export function ShipmarkCollection({ marks }: { marks: Shipmark[] }) {
  return (
    <section aria-label="Shipmarks" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-base-blue">Outship achievements</p><h2 className="text-xl font-medium">earned marks</h2></div><p className="text-xs text-text-muted-2">{marks.length} earned</p></div>
      {marks.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-text-muted-1">Your first Shipmark is waiting. Ship something and it will appear here.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{marks.map((mark) => <Card key={mark.id} mark={mark} />)}</div>}
    </section>
  );
}
