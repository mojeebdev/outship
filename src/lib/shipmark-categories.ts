export type ShipmarkCategorySlug = "firsts" | "daily" | "weekly" | "monthly" | "streaks";

export type ShipmarkCategory = {
  slug: ShipmarkCategorySlug;
  title: string;
  description: string;
  cta: string;
  matches: (code: string) => boolean;
  sql: string;
};

export const SHIPMARK_CATEGORIES: ShipmarkCategory[] = [
  {
    slug: "firsts",
    title: "firsts",
    description: "The milestones that mark the start of your Outship record.",
    cta: "See your firsts",
    matches: (code) => code === "welcome-aboard" || code === "first-ship",
    sql: `"code" IN ('welcome-aboard', 'first-ship')`,
  },
  {
    slug: "daily",
    title: "daily ships",
    description: "Daily records for showing up and moving a project forward.",
    cta: "See daily Shipmarks",
    matches: (code) => code === "daily-ship",
    sql: `"code" = 'daily-ship'`,
  },
  {
    slug: "weekly",
    title: "weekly runs",
    description: "A week of steady activity, measured across active days.",
    cta: "See weekly Shipmarks",
    matches: (code) => code === "weekly-streak",
    sql: `"code" = 'weekly-streak'`,
  },
  {
    slug: "monthly",
    title: "monthly challenges",
    description: "Monthly shipping goals and the records earned by completing them.",
    cta: "See monthly Shipmarks",
    matches: (code) => code === "monthly-challenge",
    sql: `"code" = 'monthly-challenge'`,
  },
  {
    slug: "streaks",
    title: "streak milestones",
    description: "Longer milestones for keeping your shipping practice alive.",
    cta: "See streak milestones",
    matches: (code) => code.startsWith("streak-"),
    sql: `"code" LIKE 'streak-%'`,
  },
];

export function shipmarkCategory(slug: string): ShipmarkCategory | undefined {
  return SHIPMARK_CATEGORIES.find((category) => category.slug === slug);
}
