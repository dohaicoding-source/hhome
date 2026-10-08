UPDATE "records"
SET "data" = jsonb_set(
  "data"::jsonb,
  '{tenantIds}',
  jsonb_build_array("data"::jsonb -> 'tenantId'),
  true
)::text
WHERE "kind" = 'contracts'
  AND NOT ("data"::jsonb ? 'tenantIds')
  AND jsonb_typeof("data"::jsonb -> 'tenantId') = 'string';
--> statement-breakpoint
UPDATE "records" AS target
SET "slot" = target."data"::jsonb ->> 'roomId'
WHERE target."kind" = 'contracts'
  AND target."slot" IS NOT NULL
  AND (target."data"::jsonb ->> 'active') = 'true'
  AND (
    SELECT count(*)
    FROM "records" AS active_contracts
    WHERE active_contracts."owner" = target."owner"
      AND active_contracts."kind" = 'contracts'
      AND (active_contracts."data"::jsonb ->> 'roomId') = (target."data"::jsonb ->> 'roomId')
      AND (active_contracts."data"::jsonb ->> 'active') = 'true'
  ) = 1;
--> statement-breakpoint
UPDATE "records" AS invoices
SET "data" = jsonb_set(
  invoices."data"::jsonb,
  '{tenantIds}',
  COALESCE(contracts."data"::jsonb -> 'tenantIds', jsonb_build_array(contracts."data"::jsonb -> 'tenantId')),
  true
)::text
FROM "records" AS contracts
WHERE invoices."kind" = 'invoices'
  AND NOT (invoices."data"::jsonb ? 'tenantIds')
  AND contracts."owner" = invoices."owner"
  AND contracts."kind" = 'contracts'
  AND contracts."id" = (invoices."data"::jsonb ->> 'contractId');
