-- Align the existing Welcome Aboard badge date and totals with the builder's
-- first claimed profile time. Historical rows remain BACKFILL and never mail.
UPDATE "Shipmark"
   SET "period" = substr((SELECT b."claimedAt" FROM "Builder" b WHERE b."id" = "Shipmark"."builderId"), 1, 10),
       "earnedAt" = (SELECT b."claimedAt" FROM "Builder" b WHERE b."id" = "Shipmark"."builderId"),
       "snapshot" = json_object(
         'joinedAt', (SELECT b."claimedAt" FROM "Builder" b WHERE b."id" = "Shipmark"."builderId"),
         'ships', (SELECT COUNT(*) FROM "Ship" s JOIN "Builder" b ON b."id" = "Shipmark"."builderId" WHERE s."builderId" = b."id" AND s."shippedAt" <= b."claimedAt"),
         'commits', (SELECT COUNT(DISTINCT s."commitSha") FROM "Ship" s JOIN "Builder" b ON b."id" = "Shipmark"."builderId" WHERE s."builderId" = b."id" AND s."shippedAt" <= b."claimedAt"),
         'merges', (SELECT COUNT(*) FROM "Ship" s JOIN "Builder" b ON b."id" = "Shipmark"."builderId" WHERE s."builderId" = b."id" AND s."shipType" = 'MERGE' AND s."shippedAt" <= b."claimedAt")
       )
 WHERE "code" = 'welcome-aboard'
   AND "source" = 'BACKFILL'
   AND EXISTS (SELECT 1 FROM "Builder" b WHERE b."id" = "Shipmark"."builderId" AND b."claimedAt" IS NOT NULL);
