-- Until now the installation webhook didn't set Builder.installationId; only
-- sign-in did. A builder who signed in first and installed the App after
-- (the usual order) kept looking uninstalled until their next sign-in.
-- Link each such builder to the live install on their own account, matched by
-- login, and unlink builders whose install has since been removed.
UPDATE "Builder"
   SET "installationId" = (
         SELECT i."id" FROM "Installation" i
          WHERE lower(i."accountLogin") = lower("Builder"."githubLogin")
            AND i."deletedAt" IS NULL
          ORDER BY i."createdAt" DESC
          LIMIT 1)
 WHERE "installationId" IS NULL
   AND EXISTS (
         SELECT 1 FROM "Installation" i
          WHERE lower(i."accountLogin") = lower("Builder"."githubLogin")
            AND i."deletedAt" IS NULL);

UPDATE "Builder"
   SET "installationId" = NULL
 WHERE "installationId" IN (SELECT "id" FROM "Installation" WHERE "deletedAt" IS NOT NULL);
