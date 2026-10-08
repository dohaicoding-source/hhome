UPDATE records
SET data = json_set(data, '$.tenantIds', json_array(json_extract(data, '$.tenantId')))
WHERE kind = 'contracts'
  AND json_type(data, '$.tenantIds') IS NULL
  AND json_type(data, '$.tenantId') = 'text';

UPDATE records
SET slot = json_extract(data, '$.roomId')
WHERE kind = 'contracts'
  AND slot IS NOT NULL
  AND json_extract(data, '$.active') = 1
  AND (
    SELECT COUNT(*)
    FROM records AS active_contracts
    WHERE active_contracts.owner = records.owner
      AND active_contracts.kind = 'contracts'
      AND json_extract(active_contracts.data, '$.roomId') = json_extract(records.data, '$.roomId')
      AND json_extract(active_contracts.data, '$.active') = 1
  ) = 1;

UPDATE records
SET data = json_set(
  data,
  '$.tenantIds',
  json(COALESCE(
    (
      SELECT json_extract(contracts.data, '$.tenantIds')
      FROM records AS contracts
      WHERE contracts.owner = records.owner
        AND contracts.id = json_extract(records.data, '$.contractId')
        AND contracts.kind = 'contracts'
    ),
    (
      SELECT json_array(json_extract(contracts.data, '$.tenantId'))
      FROM records AS contracts
      WHERE contracts.owner = records.owner
        AND contracts.id = json_extract(records.data, '$.contractId')
        AND contracts.kind = 'contracts'
    )
  ))
)
WHERE kind = 'invoices'
  AND json_type(data, '$.tenantIds') IS NULL;
