// The numbers behind the overview at the top of /profile, worked out from the
// builder's own ships. Pure, so the maths is tested on its own; the page only
// loads the ships and draws the result. Points use the scoring's own daily
// caps (shipPoints), so a day here adds up the same way the score does.
import { shipPoints, toUtcDayNumber, type ScorableShip } from "@/lib/score";
import { weekStart, type Bucket } from "@/lib/metrics";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type OverviewShip = ScorableShip;

export type ProfileOverview = {
  /** Points per UTC day, the last 30 days, oldest first. */
  dailyPoints: Bucket[];
  pointsThisWeek: number;
  pointsLastWeek: number;
  /** Points per week, the last 8 weeks (Monday to Sunday, UTC), oldest first. */
  weeklyPoints: number[];
  shipsThisMonth: number;
  shipsLastMonth: number;
  /** Ships per week, the last 8 weeks, oldest first. */
  weeklyShips: number[];
  /** 1 for each of the last 14 UTC days with a ship, oldest first. */
  activeDays: number[];
  /** Ships by UTC weekday (0 = Sunday) and hour. */
  weekHour: number[][];
  byType: { RELEASE: number; MERGE: number; PUSH: number };
};

/** The relative change, or null when there's nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export function profileOverview(ships: OverviewShip[], now = new Date()): ProfileOverview {
  const today = toUtcDayNumber(now);
  const thisWeek = weekStart(now).getTime();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const lastMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);

  const byDay = new Map<number, OverviewShip[]>();
  const weekHour = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const byType = { RELEASE: 0, MERGE: 0, PUSH: 0 };
  const weeklyShips = new Array<number>(8).fill(0);
  let shipsThisMonth = 0;
  let shipsLastMonth = 0;

  for (const ship of ships) {
    const at = ship.shippedAt.getTime();
    const day = toUtcDayNumber(ship.shippedAt);
    const list = byDay.get(day);
    if (list) list.push(ship);
    else byDay.set(day, [ship]);
    weekHour[ship.shippedAt.getUTCDay()][ship.shippedAt.getUTCHours()]++;
    byType[ship.shipType]++;
    if (at >= monthStart) shipsThisMonth++;
    else if (at >= lastMonthStart) shipsLastMonth++;
    const weeksAgo = Math.floor((thisWeek - weekStart(ship.shippedAt).getTime()) / WEEK);
    if (weeksAgo >= 0 && weeksAgo < 8) weeklyShips[7 - weeksAgo]++;
  }

  // Each day scored on its own, with the daily caps: the same sum the score is.
  const pointsOn = (day: number) => shipPoints(byDay.get(day) ?? []);
  const dailyPoints = Array.from({ length: 30 }, (_, i) => {
    const day = today - 29 + i;
    return { start: new Date(day * DAY), value: pointsOn(day) };
  });
  const weekDayNumber = Math.floor(thisWeek / DAY);
  const pointsInWeek = (weeksAgo: number) => {
    let sum = 0;
    for (let d = 0; d < 7; d++) sum += pointsOn(weekDayNumber - weeksAgo * 7 + d);
    return sum;
  };
  const weeklyPoints = Array.from({ length: 8 }, (_, i) => pointsInWeek(7 - i));
  const activeDays = Array.from({ length: 14 }, (_, i) => (byDay.has(today - 13 + i) ? 1 : 0));

  return {
    dailyPoints,
    pointsThisWeek: weeklyPoints[7],
    pointsLastWeek: weeklyPoints[6],
    weeklyPoints,
    shipsThisMonth,
    shipsLastMonth,
    weeklyShips,
    activeDays,
    weekHour,
    byType,
  };
}
