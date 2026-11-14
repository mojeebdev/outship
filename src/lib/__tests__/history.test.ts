import assert from "node:assert/strict";
import test from "node:test";

import {
  HEATMAP_WEEKS,
  countByDay,
  heatmapCells,
  historyWindow,
  intensity,
  parseContributions,
  shouldSyncHistory,
} from "../history";

const NOW = new Date("2026-11-14T15:00:00Z"); // a Saturday

test("history syncs at most once a day", () => {
  assert.equal(shouldSyncHistory(null, NOW), true);
  assert.equal(shouldSyncHistory(new Date("2026-11-14T03:00:00Z"), NOW), false);
  assert.equal(shouldSyncHistory(new Date("2026-11-13T14:59:59Z"), NOW), true);
});

test("the window is the last 365 days", () => {
  assert.deepEqual(historyWindow(NOW), { from: "2025-11-14T15:00:00.000Z", to: "2026-11-14T15:00:00.000Z" });
});

test("GitHub's answer parses into totals and non-empty days", () => {
  const parsed = parseContributions({
    data: {
      viewer: {
        contributionsCollection: {
          totalCommitContributions: 120,
          totalPullRequestContributions: 14,
          totalPullRequestReviewContributions: 9,
          restrictedContributionsCount: 40,
          contributionCalendar: {
            totalContributions: 183,
            weeks: [
              { contributionDays: [{ date: "2026-11-08", contributionCount: 0 }, { date: "2026-11-09", contributionCount: 3 }] },
              { contributionDays: [{ date: "nonsense", contributionCount: 5 }, { date: "2026-11-14", contributionCount: 7 }] },
            ],
          },
        },
      },
    },
  });
  assert.deepEqual(parsed, {
    totals: {
      historyContributions: 183,
      historyCommits: 120,
      historyPullRequests: 14,
      historyReviews: 9,
      historyRestricted: 40,
    },
    days: [
      { date: "2026-11-09", count: 3 },
      { date: "2026-11-14", count: 7 },
    ],
  });
});

test("an error or unexpected answer is null, not zeroes", () => {
  assert.equal(parseContributions({ errors: [{ message: "Bad credentials" }] }), null);
  assert.equal(parseContributions(null), null);
});

test("the heatmap is 53 weeks of Sunday-first columns ending today", () => {
  const cells = heatmapCells(new Map([["2026-11-14", 4], ["2026-11-10", 1]]), NOW);
  assert.equal(cells.at(-1)?.date, "2026-11-14");
  assert.equal(cells[0].weekday, 0);
  assert.equal(new Date(`${cells[0].date}T00:00:00Z`).getUTCDay(), 0, "starts on a sunday");
  assert.equal(cells.at(-1)?.week, HEATMAP_WEEKS - 1);
  assert.equal(cells.length, (HEATMAP_WEEKS - 1) * 7 + 7);
  assert.equal(cells.find((cell) => cell.date === "2026-11-14")?.level, 4);
  assert.equal(cells.find((cell) => cell.date === "2026-11-10")?.level, 1);
  assert.equal(cells.find((cell) => cell.date === "2026-11-11")?.level, 0);
});

test("a midweek today leaves the rest of the week out", () => {
  const wednesday = new Date("2026-11-11T09:00:00Z");
  const cells = heatmapCells(new Map(), wednesday);
  assert.equal(cells.at(-1)?.date, "2026-11-11");
  assert.equal(cells.at(-1)?.weekday, 3);
});

test("intensity steps scale with the busiest day", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 8].map((n) => intensity(n, 8)), [0, 1, 1, 2, 2, 4]);
  assert.equal(intensity(5, 0), 0);
});

test("ships are counted per UTC day", () => {
  const counts = countByDay([new Date("2026-11-14T00:30:00Z"), new Date("2026-11-14T23:59:00Z"), new Date("2026-11-13T23:59:59Z")]);
  assert.deepEqual([...counts], [["2026-11-14", 2], ["2026-11-13", 1]]);
});
