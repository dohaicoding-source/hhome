UPDATE records
SET slot = json_extract(data, '$.roomId') || ':' || json_extract(data, '$.tenantId')
WHERE kind = 'contracts' AND slot IS NOT NULL;
