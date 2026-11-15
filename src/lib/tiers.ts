// Tiers: a name for how far a builder has climbed, from their all-time score.
// Purely a reading of the score (no separate state), so it can't drift from
// it and can't be bought: only verified ships move it. Bragging rights.

export const TIERS = [
  { name: "deckhand", min: 0 },
  { name: "sailor", min: 500 },
  { name: "navigator", min: 2_000 },
  { name: "first mate", min: 5_000 },
  { name: "captain", min: 12_000 },
  { name: "admiral", min: 25_000 },
] as const;

export type Tier = (typeof TIERS)[number];

export type TierStanding = {
  tier: Tier;
  /** The next tier up, or null at the top. */
  next: Tier | null;
  /** Points still needed for the next tier. */
  toNext: number;
  /** 0–1 through the current tier, for a progress bar. */
  progress: number;
};

export function tierFor(score: number): TierStanding {
  const points = Math.max(0, Math.floor(score));
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) if (points >= TIERS[i].min) index = i;
  const tier = TIERS[index];
  const next = TIERS[index + 1] ?? null;
  if (!next) return { tier, next: null, toNext: 0, progress: 1 };
  return { tier, next, toNext: next.min - points, progress: (points - tier.min) / (next.min - tier.min) };
}
