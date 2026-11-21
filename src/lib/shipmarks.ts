/**
 * Shipmarks are immutable snapshots derived from verified Outship records.
 * Period boundaries and rankings use UTC. Every write is idempotent.
 */
const DAY = 86400000;

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function utcMonday(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(midnight - ((date.getUTCDay() + 6) % 7) * DAY);
}

/** Ensure signed-in builders have the welcome record, including older accounts. */
export async function ensureWelcomeShipmark(db: D1Database, builderId: string): Promise<void> {
  await db.prepare(
    'INSERT OR IGNORE INTO "Shipmark" ("id","builderId","code","period","earnedAt","snapshot","source") ' +
    'SELECT lower(hex(randomblob(16))),b."id",\'welcome-aboard\',substr(b."createdAt",1,10),b."createdAt", ' +
    'json_object(\'joinedAt\',b."createdAt",\'ships\',(SELECT COUNT(*) FROM "Ship" s WHERE s."builderId"=b."id" AND s."shippedAt"<=b."createdAt"),' +
    '\'commits\',(SELECT COUNT(DISTINCT s."commitSha") FROM "Ship" s WHERE s."builderId"=b."id" AND s."shippedAt"<=b."createdAt"),' +
    '\'merges\',(SELECT COUNT(*) FROM "Ship" s WHERE s."builderId"=b."id" AND s."shipType"=\'MERGE\' AND s."shippedAt"<=b."createdAt")),\'BACKFILL\' ' +
    'FROM "Builder" b WHERE b."id"=?1',
  ).bind(builderId).run();
}

export async function awardDailyShipmarks(db: D1Database, day: string): Promise<number> {
  const start = new Date(day + "T00:00:00.000Z");
  const end = new Date(start.getTime() + DAY);
  const result = await db.prepare(
    "WITH daily AS (" +
    " SELECT s.builderId, COUNT(*) AS ships, COUNT(DISTINCT s.commitSha) AS commits," +
    " SUM(CASE WHEN s.shipType='MERGE' THEN 1 ELSE 0 END) AS merges" +
    " FROM Ship s WHERE s.shippedAt >= ?1 AND s.shippedAt < ?2 GROUP BY s.builderId" +
    "), ranked AS (" +
    " SELECT daily.*, ROW_NUMBER() OVER (ORDER BY ships DESC, commits DESC, merges DESC, builderId ASC) AS rank FROM daily" +
    ") INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'daily-ship',?3,?4," +
    " json_object('ships',ships,'commits',commits,'merges',merges,'rank',rank),'SCHEDULED' FROM ranked"
  ).bind(start.toISOString(), end.toISOString(), day, new Date().toISOString()).run();
  return result.meta.changes ?? 0;
}

export async function awardWeeklyShipmarks(db: D1Database, week: string): Promise<number> {
  const start = new Date(week + "T00:00:00.000Z");
  const end = new Date(start.getTime() + 7 * DAY);
  const result = await db.prepare(
    "WITH weekly AS (" +
    " SELECT s.builderId,COUNT(*) AS ships,COUNT(DISTINCT s.commitSha) AS commits," +
    " SUM(CASE WHEN s.shipType='MERGE' THEN 1 ELSE 0 END) AS merges," +
    " COUNT(DISTINCT strftime('%Y-%m-%d',s.shippedAt)) AS activeDays" +
    " FROM Ship s WHERE s.shippedAt >= ?1 AND s.shippedAt < ?2 GROUP BY s.builderId" +
    ") INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'weekly-streak',?3,?4," +
    " json_object('ships',ships,'commits',commits,'merges',merges,'activeDays',activeDays),'SCHEDULED' FROM weekly WHERE activeDays >= 5"
  ).bind(start.toISOString(), end.toISOString(), week, new Date().toISOString()).run();
  return result.meta.changes ?? 0;
}

/** One-time historical backfill. It never sends email and is safe to rerun. */
export async function backfillShipmarks(db: D1Database) {
  const joined = await db.prepare(
    "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),b.id,'welcome-aboard',substr(b.createdAt,1,10),b.createdAt," +
    " json_object('joinedAt',b.createdAt,'ships',(SELECT COUNT(*) FROM Ship s WHERE s.builderId=b.id AND s.shippedAt <= b.createdAt)," +
    " 'commits',(SELECT COUNT(DISTINCT s.commitSha) FROM Ship s WHERE s.builderId=b.id AND s.shippedAt <= b.createdAt),'merges',(SELECT COUNT(*) FROM Ship s WHERE s.builderId=b.id AND s.shipType='MERGE' AND s.shippedAt <= b.createdAt)),'BACKFILL' FROM Builder b"
  ).run();
  const firstShip = await db.prepare(
    "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'first-ship','lifetime',MIN(shippedAt)," +
    " json_object('firstShipAt',MIN(shippedAt)),'BACKFILL' FROM Ship GROUP BY builderId"
  ).run();
  const daily = await db.prepare(
    "WITH daily AS (SELECT builderId,strftime('%Y-%m-%d',shippedAt) AS day,COUNT(*) AS ships," +
    " COUNT(DISTINCT commitSha) AS commits,SUM(CASE WHEN shipType='MERGE' THEN 1 ELSE 0 END) AS merges" +
    " FROM Ship GROUP BY builderId,day), ranked AS (" +
    " SELECT daily.*,ROW_NUMBER() OVER (PARTITION BY day ORDER BY ships DESC,commits DESC,merges DESC,builderId ASC) AS rank FROM daily)" +
    " INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'daily-ship',day,day || 'T23:59:59.999Z'," +
    " json_object('ships',ships,'commits',commits,'merges',merges,'rank',rank),'BACKFILL' FROM ranked"
  ).run();
  const weekly = await db.prepare(
    "WITH weekly AS (SELECT builderId,date(shippedAt,'-' || ((CAST(strftime('%w',shippedAt) AS INTEGER)+6)%7) || ' days') AS week," +
    " COUNT(*) AS ships,COUNT(DISTINCT commitSha) AS commits," +
    " SUM(CASE WHEN shipType='MERGE' THEN 1 ELSE 0 END) AS merges," +
    " COUNT(DISTINCT strftime('%Y-%m-%d',shippedAt)) AS activeDays FROM Ship GROUP BY builderId,week)" +
    " INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'weekly-streak',week,datetime(week,'+7 days')," +
    " json_object('ships',ships,'commits',commits,'merges',merges,'activeDays',activeDays),'BACKFILL' FROM weekly WHERE activeDays >= 5"
  ).run();
  const monthly = await db.prepare(
    "WITH monthly AS (SELECT builderId,strftime('%Y-%m',shippedAt) AS month,COUNT(*) AS ships," +
    " COUNT(DISTINCT strftime('%Y-%m-%d',shippedAt)) AS activeDays FROM Ship GROUP BY builderId,month)" +
    " INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'monthly-challenge',month,month || '-01T00:00:00.000Z'," +
    " json_object('ships',ships,'activeDays',activeDays,'challenge','20 ships'),'BACKFILL' FROM monthly WHERE ships >= 20"
  ).run();
  const milestones = await db.prepare(
    "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),b.id,'streak-' || m.days,'lifetime-' || m.days," +
    " COALESCE(b.lastShipDate,b.createdAt),json_object('days',m.days,'longestStreak',b.longestStreak),'BACKFILL'" +
    " FROM Builder b JOIN (SELECT 3 AS days UNION ALL SELECT 7 UNION ALL SELECT 14 UNION ALL SELECT 30 UNION ALL SELECT 100) m" +
    " ON b.longestStreak >= m.days"
  ).run();
  return {
    joined: joined.meta.changes ?? 0,
    firstShip: firstShip.meta.changes ?? 0,
    daily: daily.meta.changes ?? 0,
    weekly: weekly.meta.changes ?? 0,
    monthly: monthly.meta.changes ?? 0,
    milestones: milestones.meta.changes ?? 0
  };
}

export async function awardMonthlyShipmarks(db: D1Database, month: string): Promise<number> {
  const start = new Date(month + "-01T00:00:00.000Z");
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const result = await db.prepare(
    "WITH monthly AS (SELECT builderId,COUNT(*) AS ships,COUNT(DISTINCT strftime('%Y-%m-%d',shippedAt)) AS activeDays FROM Ship WHERE shippedAt >= ?1 AND shippedAt < ?2 GROUP BY builderId)" +
    " INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'monthly-challenge',?3,?4,json_object('ships',ships,'activeDays',activeDays,'challenge','20 ships'),'SCHEDULED' FROM monthly WHERE ships >= 20"
  ).bind(start.toISOString(), end.toISOString(), month, new Date().toISOString()).run();
  return result.meta.changes ?? 0;
}

export async function awardStreakMilestones(db: D1Database): Promise<number> {
  const result = await db.prepare(
    "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),b.id,'streak-' || m.days,'lifetime-' || m.days,COALESCE(b.lastShipDate,b.createdAt)," +
    " json_object('days',m.days,'longestStreak',b.longestStreak),'SCHEDULED' FROM Builder b" +
    " JOIN (SELECT 3 AS days UNION ALL SELECT 7 UNION ALL SELECT 14 UNION ALL SELECT 30 UNION ALL SELECT 100) m ON b.longestStreak >= m.days"
  ).run();
  return result.meta.changes ?? 0;
}

export async function awardFirstShipmarks(db: D1Database): Promise<number> {
  const result = await db.prepare(
    "INSERT OR IGNORE INTO Shipmark (id,builderId,code,period,earnedAt,snapshot,source)" +
    " SELECT lower(hex(randomblob(16))),builderId,'first-ship','lifetime',MIN(shippedAt),json_object('firstShipAt',MIN(shippedAt)),'SCHEDULED' FROM Ship GROUP BY builderId"
  ).run();
  return result.meta.changes ?? 0;
}
