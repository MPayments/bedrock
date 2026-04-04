UPDATE "documents"
SET "payload" = "payload" - 'mode'
WHERE "doc_type" = 'invoice'
  AND "payload" ->> 'mode' = 'direct';

UPDATE "document_snapshots" AS "snapshots"
SET "payload" = "snapshots"."payload" - 'mode'
FROM "documents"
WHERE "documents"."id" = "snapshots"."document_id"
  AND "documents"."doc_type" = 'invoice'
  AND "snapshots"."payload" ->> 'mode' = 'direct';

WITH "normalized_exchange_invoices" AS (
  SELECT
    "documents"."id",
    jsonb_build_object(
      'occurredAt',
      "documents"."payload" ->> 'occurredAt',
      'customerId',
      "documents"."payload" ->> 'customerId',
      'counterpartyId',
      "documents"."payload" ->> 'counterpartyId',
      'organizationId',
      COALESCE("documents"."payload" -> 'organizationId', 'null'::jsonb),
      'organizationRequisiteId',
      "documents"."payload" ->> 'organizationRequisiteId',
      'amount',
      CASE
        WHEN "currencies"."precision" = 0 THEN
          "documents"."payload" #>> '{quoteSnapshot,fromAmountMinor}'
        ELSE
          regexp_replace(
            regexp_replace(
              (
                ("documents"."payload" #>> '{quoteSnapshot,fromAmountMinor}')::numeric
                / power(10::numeric, "currencies"."precision")
              )::text,
              '0+$',
              ''
            ),
            '\.$',
            ''
          )
      END,
      'amountMinor',
      "documents"."payload" #> '{quoteSnapshot,fromAmountMinor}',
      'currency',
      "documents"."payload" #> '{quoteSnapshot,fromCurrency}',
      'financialLines',
      COALESCE(
        "documents"."payload" #> '{quoteSnapshot,financialLines}',
        '[]'::jsonb
      ),
      'memo',
      COALESCE("documents"."payload" -> 'memo', 'null'::jsonb)
    ) AS "normalized_payload"
  FROM "documents"
  INNER JOIN "currencies"
    ON "currencies"."code" = upper("documents"."payload" #>> '{quoteSnapshot,fromCurrency}')
  WHERE "documents"."doc_type" = 'invoice'
    AND "documents"."payload" ->> 'mode' = 'exchange'
)
UPDATE "documents"
SET "payload" = "normalized_exchange_invoices"."normalized_payload"
FROM "normalized_exchange_invoices"
WHERE "documents"."id" = "normalized_exchange_invoices"."id";

WITH "normalized_exchange_snapshots" AS (
  SELECT
    "snapshots"."id",
    jsonb_build_object(
      'occurredAt',
      "snapshots"."payload" ->> 'occurredAt',
      'customerId',
      "snapshots"."payload" ->> 'customerId',
      'counterpartyId',
      "snapshots"."payload" ->> 'counterpartyId',
      'organizationId',
      COALESCE("snapshots"."payload" -> 'organizationId', 'null'::jsonb),
      'organizationRequisiteId',
      "snapshots"."payload" ->> 'organizationRequisiteId',
      'amount',
      CASE
        WHEN "currencies"."precision" = 0 THEN
          "snapshots"."payload" #>> '{quoteSnapshot,fromAmountMinor}'
        ELSE
          regexp_replace(
            regexp_replace(
              (
                ("snapshots"."payload" #>> '{quoteSnapshot,fromAmountMinor}')::numeric
                / power(10::numeric, "currencies"."precision")
              )::text,
              '0+$',
              ''
            ),
            '\.$',
            ''
          )
      END,
      'amountMinor',
      "snapshots"."payload" #> '{quoteSnapshot,fromAmountMinor}',
      'currency',
      "snapshots"."payload" #> '{quoteSnapshot,fromCurrency}',
      'financialLines',
      COALESCE(
        "snapshots"."payload" #> '{quoteSnapshot,financialLines}',
        '[]'::jsonb
      ),
      'memo',
      COALESCE("snapshots"."payload" -> 'memo', 'null'::jsonb)
    ) AS "normalized_payload"
  FROM "document_snapshots" AS "snapshots"
  INNER JOIN "documents"
    ON "documents"."id" = "snapshots"."document_id"
  INNER JOIN "currencies"
    ON "currencies"."code" = upper("snapshots"."payload" #>> '{quoteSnapshot,fromCurrency}')
  WHERE "documents"."doc_type" = 'invoice'
    AND "snapshots"."payload" ->> 'mode' = 'exchange'
)
UPDATE "document_snapshots"
SET "payload" = "normalized_exchange_snapshots"."normalized_payload"
FROM "normalized_exchange_snapshots"
WHERE "document_snapshots"."id" = "normalized_exchange_snapshots"."id";

UPDATE "documents"
SET "payload" = "payload" - 'invoiceMode'
WHERE "doc_type" = 'acceptance'
  AND "payload" ? 'invoiceMode';

UPDATE "document_snapshots" AS "snapshots"
SET "payload" = "snapshots"."payload" - 'invoiceMode'
FROM "documents"
WHERE "documents"."id" = "snapshots"."document_id"
  AND "documents"."doc_type" = 'acceptance'
  AND "snapshots"."payload" ? 'invoiceMode';
