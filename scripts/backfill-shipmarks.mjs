// Backfills historical achievement Shipmarks into D1. Dry run by default;
// pass --apply to write and --remote to target production D1.
import { d1, d1Target } from "./lib/d1.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const target = d1Target(args);

const [builders, ships, existing] = d1(
  'SELECT COUNT(*) AS n FROM "Builder"; SELECT COUNT(*) AS n FROM "Ship"; SELECT COUNT(*) AS n FROM "Shipmark"',
  target,
);

console.log(
  `${builders[0]?.n ?? 0} builder(s), ${ships[0]?.n ?? 0} ship(s), ${existing[0]?.n ?? 0} existing Shipmark(s) in ${target === "--remote" ? "production" : "local"} D1`,
);

if (!apply) {
  console.log("dry run: nothing written. Re-run with --apply to backfill.");
  process.exit(0);
}

const statements = [
  "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source) SELECT lower(hex(randomblob(16))),b.id,'welcome-aboard',substr(b.createdAt,1,10),b.createdAt,json_object('joinedAt',b.createdAt,'ships',(SELECT COUNT(*) FROM Ship s WHERE s.builderId=b.id AND s.shippedAt<=b.createdAt),'commits',(SELECT COUNT(DISTINCT s.commitSha) FROM Ship s WHERE s.builderId=b.id AND s.shippedAt<=b.createdAt),'merges',(SELECT COUNT(*) FROM Ship s WHERE s.builderId=b.id AND s.shipType='MERGE' AND s.shippedAt<=b.createdAt)),'BACKFILL' FROM Builder b",
  "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source) SELECT lower(hex(randomblob(16))),builderId,'first-ship','lifetime',MIN(shippedAt),json_object('firstShipAt',MIN(shippedAt)),'BACKFILL' FROM Ship GROUP BY builderId",
  "WITH daily AS (SELECT builderId,strftime('%Y-%m-%d',shippedAt) AS day,COUNT(*) AS ships,COUNT(DISTINCT commitSha) AS commits,SUM(CASE WHEN shipType='MERGE' THEN 1 ELSE 0 END) AS merges FROM Ship GROUP BY builderId,day), ranked AS (SELECT daily.*,ROW_NUMBER() OVER (PARTITION BY day ORDER BY ships DESC,commits DESC,merges DESC,builderId ASC) AS rank FROM daily) INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source) SELECT lower(hex(randomblob(16))),builderId,'daily-ship',day,day || 'T23:59:59.999Z',json_object('ships',ships,'commits',commits,'merges',merges,'rank',rank),'BACKFILL' FROM ranked",
  "WITH weekly AS (SELECT builderId,date(shippedAt,'-' || ((CAST(strftime('%w',shippedAt) AS INTEGER)+6)%7) || ' days') AS week,COUNT(*) AS ships,COUNT(DISTINCT commitSha) AS commits,SUM(CASE WHEN shipType='MERGE' THEN 1 ELSE 0 END) AS merges,COUNT(DISTINCT strftime('%Y-%m-%d',shippedAt)) AS activeDays FROM Ship GROUP BY builderId,week) INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source) SELECT lower(hex(randomblob(16))),builderId,'weekly-streak',week,datetime(week,'+7 days'),json_object('ships',ships,'commits',commits,'merges',merges,'activeDays',activeDays),'BACKFILL' FROM weekly WHERE activeDays>=5",
  "WITH monthly AS (SELECT builderId,strftime('%Y-%m',shippedAt) AS month,COUNT(*) AS ships,COUNT(DISTINCT strftime('%Y-%m-%d',shippedAt)) AS activeDays FROM Ship GROUP BY builderId,month) INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source) SELECT lower(hex(randomblob(16))),builderId,'monthly-challenge',month,month || '-01T00:00:00.000Z',json_object('ships',ships,'activeDays',activeDays,'challenge','20 ships'),'BACKFILL' FROM monthly WHERE ships>=20",
  "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source) SELECT lower(hex(randomblob(16))),b.id,'streak-' || m.days,'lifetime-' || m.days,COALESCE(b.lastShipDate,b.createdAt),json_object('days',m.days,'longestStreak',b.longestStreak),'BACKFILL' FROM Builder b JOIN (SELECT 3 AS days UNION ALL SELECT 7 UNION ALL SELECT 14 UNION ALL SELECT 30 UNION ALL SELECT 100) m ON b.longestStreak>=m.days",
];

const labels = ["welcome aboard", "first ship", "daily", "weekly streak", "monthly challenge", "streak milestones"];
const counts = [];
for (const [index, statement] of statements.entries()) {
  const [{ n }] = d1(`${statement}; SELECT changes() AS n`, target)[1];
  counts.push(Number(n));
  console.log(`  ${labels[index]}: ${n}`);
}
console.log(`Backfill complete: ${counts.reduce((sum, count) => sum + count, 0)} Shipmark(s) created. No emails sent.`);
