// v1 ranking formula: releases weigh more than merges (a stronger "shipped
// something real" signal), streak is capped so it can't dominate output.
const RELEASE_WEIGHT = 5;
const MERGE_WEIGHT = 2;
const STREAK_CAP = 30;

export function computeScore({
  releases,
  merges,
  currentStreak,
}: {
  releases: number;
  merges: number;
  currentStreak: number;
}): number {
  return (
    releases * RELEASE_WEIGHT +
    merges * MERGE_WEIGHT +
    Math.min(currentStreak, STREAK_CAP)
  );
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
