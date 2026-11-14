// Ranking formula: releases weigh most (a stronger "shipped something real"
// signal), then merged PRs, then pushes. Streak is capped so it can't
// dominate output.
export const SHIP_WEIGHTS = { RELEASE: 5, MERGE: 2, PUSH: 1 } as const;
export const STREAK_CAP = 30;

// How many ships of each type can score per builder per UTC day. Ships past
// the cap are still recorded and shown; they just don't add points, so a
// script publishing empty releases or self-merging PRs can't farm the board.
// Per builder rather than per repo, so spinning up more repos doesn't help.
export const DAILY_CAPS = { RELEASE: 2, MERGE: 5, PUSH: 1 } as const;

type ShipType = keyof typeof SHIP_WEIGHTS;

export function shipPoints(ships: { shipType: ShipType; shippedAt: Date }[]): number {
  const countedToday = new Map<string, number>();
  let points = 0;
  for (const ship of ships) {
    const key = `${toUtcDayNumber(ship.shippedAt)}:${ship.shipType}`;
    const count = (countedToday.get(key) ?? 0) + 1;
    countedToday.set(key, count);
    if (count <= DAILY_CAPS[ship.shipType]) points += SHIP_WEIGHTS[ship.shipType];
  }
  return points;
}

export function computeScore({
  points,
  currentStreak,
}: {
  points: number;
  currentStreak: number;
}): number {
  return points + Math.min(currentStreak, STREAK_CAP);
}

function toUtcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      86_400_000,
  );
}

export function applyShipToStreak(
  {
    currentStreak,
    longestStreak,
    lastShipDate,
  }: {
    currentStreak: number;
    longestStreak: number;
    lastShipDate: Date | null;
  },
  shippedAt: Date,
): { currentStreak: number; longestStreak: number; lastShipDate: Date } {
  const shipDay = toUtcDayNumber(shippedAt);
  const lastDay = lastShipDate ? toUtcDayNumber(lastShipDate) : null;

  let nextStreak: number;
  if (lastDay === null || shipDay > lastDay + 1) {
    nextStreak = 1;
  } else if (shipDay === lastDay + 1) {
    nextStreak = currentStreak + 1;
  } else {
    // same day, or an older event arriving out of order — don't regress
    nextStreak = currentStreak;
  }

  const nextLastShipDate =
    lastShipDate && shipDay < (lastDay as number) ? lastShipDate : shippedAt;

  return {
    currentStreak: nextStreak,
    longestStreak: Math.max(longestStreak, nextStreak),
    lastShipDate: nextLastShipDate,
  };
}
