"use client";
import { useState } from "react";

export type Shipmark = { id: string; code: string; period: string; earnedAt: string; snapshot: string };
const styles: Record<string, { title: string; subtitle: string; symbol: string; tone: string }> = {
  "welcome-aboard": { title: "Welcome Aboard", subtitle: "Your Outship journey starts here", symbol: "⚓", tone: "from-sky-950 to-slate-800" },
  "first-ship": { title: "First Ship", subtitle: "Your first verified ship", symbol: "🚢", tone: "from-blue-950 to-indigo-900" },
  "daily-ship": { title: "Daily Shipmark", subtitle: "You showed up and shipped", symbol: "✦", tone: "from-cyan-950 to-blue-900" },
  "weekly-streak": { title: "Weekly Streak", subtitle: "A week of making progress", symbol: "🔥", tone: "from-amber-950 to-orange-900" },
  "monthly-challenge": { title: "Monthly Challenge", subtitle: "20 or more ships in a month", symbol: "🏆", tone: "from-yellow-950 to-amber-900" },
  "streak-3": { title: "3-Day Streak", subtitle: "Three days of consistency", symbol: "✧", tone: "from-slate-800 to-slate-600" },
  "streak-7": { title: "7-Day Streak", subtitle: "A full week of consistency", symbol: "🔥", tone: "from-blue-950 to-sky-800" },
  "streak-14": { title: "14-Day Streak", subtitle: "Two weeks of consistency", symbol: "✦", tone: "from-indigo-950 to-blue-800" },
  "streak-30": { title: "30-Day Streak", subtitle: "A month of consistency", symbol: "✹", tone: "from-amber-950 to-yellow-800" },
  "streak-100": { title: "100-Day Streak", subtitle: "A hundred days of showing up", symbol: "✺", tone: "from-slate-950 to-slate-700" }
};
function Card({ mark }: { mark: Shipmark }) {
  const [back, setBack] = useState(false);
  const badge = styles[mark.code] ?? { title: "Shipmark", subtitle: "An Outship achievement", symbol: "⚓", tone: "from-slate-900 to-blue-950" };
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(mark.snapshot) as Record<string, unknown>; } catch { /* ignore malformed legacy data */ }
  const stats = Object.entries(data).filter(([key, value]) => key !== "joinedAt" && value !== null && value !== undefined);
  const earned = new Date(mark.earnedAt);
  const date = Number.isNaN(earned.getTime()) ? mark.period : earned.toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" });
  return <button type="button" onClick={() => setBack(!back)} aria-pressed={back} aria-label={badge.title + (back ? ", show front" : ", reveal details")} className="group text-left [perspective:900px]">
    <span className={`relative block aspect-[4/5] w-full rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] ${back ? "[transform:rotateY(180deg)]" : ""}`}>
      <span className={`absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br ${badge.tone} p-4 text-white shadow-lg [backface-visibility:hidden]`}>
        <span className="w-full text-[9px] font-semibold uppercase tracking-[.24em] text-white/65">OUTSHIP · SHIPMARK</span>
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/35 bg-white/10 text-4xl shadow-inner">{badge.symbol}</span>
        <span className="text-center"><span className="block text-sm font-semibold tracking-wide">{badge.title}</span><span className="mt-1 block text-[10px] text-white/65">{badge.subtitle}</span></span>
        <span className="text-[9px] uppercase tracking-[.2em] text-white/55">{date}</span>
      </span>
      <span className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101e2b] p-4 text-white shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <span className="text-[9px] font-semibold uppercase tracking-[.2em] text-sky-300">YOUR RECORD</span>
        <span className="mt-3 text-sm font-semibold">{badge.title}</span><span className="mt-1 text-[10px] text-white/55">{mark.period}</span>
        <span className="mt-4 flex flex-col gap-2">{stats.map(([key, value]) => <span key={key} className="flex items-center justify-between gap-2 border-b border-white/10 pb-1 text-xs"><span className="text-white/60">{key.replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase())}</span><strong>{String(value)}</strong></span>)}
          {typeof data.joinedAt === "string" && <span className="mt-1 text-[10px] text-white/60">Joined {new Date(data.joinedAt).toLocaleString("en", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</span>}
        </span>
        <span className="mt-auto text-[9px] uppercase tracking-[.2em] text-white/45">OUTSHIP · VERIFIED ACTIVITY</span>
      </span>
    </span>
    <span className="mt-2 block text-center text-[10px] text-text-muted-1">{back ? "tap to flip back" : "tap to reveal"}</span>
  </button>;
}
export function ShipmarkCollection({ marks }: { marks: Shipmark[] }) {
  return <section id="shipmarks" aria-label="Shipmarks" className="flex scroll-mt-20 flex-col gap-4">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-base-blue">Outship achievements</p><h2 className="text-xl font-medium">Shipmarks</h2></div><p className="text-xs text-text-muted-2">{marks.length} earned</p></div>
    {marks.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-text-muted-1">Your first Shipmark is waiting. Ship something and it will appear here.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{marks.map((mark) => <Card key={mark.id} mark={mark} />)}</div>}
  </section>;
}
