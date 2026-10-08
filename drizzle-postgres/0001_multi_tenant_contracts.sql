UPDATE "records"
SET "slot" = ("data"::jsonb ->> 'roomId') || ':' || ("data"::jsonb ->> 'tenantId')
WHERE "kind" = 'contracts' AND "slot" IS NOT NULL;
