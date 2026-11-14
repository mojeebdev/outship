import { leaderboardImage } from "@/lib/leaderboard-og";
import { OG_SIZE } from "@/lib/og";
import { PERIOD_LABELS } from "@/lib/leaderboard";

export const alt = `outship leaderboard, ${PERIOD_LABELS.month}`;
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default function Image() {
  return leaderboardImage("month");
}
