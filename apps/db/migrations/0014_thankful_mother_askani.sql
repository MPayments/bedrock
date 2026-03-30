CREATE TABLE "document_business_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL,
  "deal_id" uuid,
  "link_kind" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "document_business_links_exactly_one_owner_chk" CHECK ("document_business_links"."deal_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "deal_id" uuid;
--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "used_document_id" uuid;
--> statement-breakpoint
ALTER TABLE "document_business_links" ADD CONSTRAINT "document_business_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_business_links" ADD CONSTRAINT "document_business_links_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_used_document_id_documents_id_fk" FOREIGN KEY ("used_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "document_business_links_document_uq" ON "document_business_links" USING btree ("document_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "document_business_links_document_deal_kind_uq" ON "document_business_links" USING btree ("document_id","deal_id","link_kind");
--> statement-breakpoint
CREATE INDEX "document_business_links_deal_idx" ON "document_business_links" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX "document_business_links_document_idx" ON "document_business_links" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "fx_quotes_deal_created_idx" ON "fx_quotes" USING btree ("deal_id","created_at");
--> statement-breakpoint
CREATE INDEX "fx_quotes_used_document_idx" ON "fx_quotes" USING btree ("used_document_id");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    WITH quote_deal_candidates AS (
      SELECT DISTINCT
        cs.fx_quote_id AS quote_id,
        d.id AS deal_id
      FROM calculation_snapshots cs
      INNER JOIN calculations c
        ON c.id = cs.calculation_id
      INNER JOIN deals d
        ON d.calculation_id = c.id
      WHERE cs.fx_quote_id IS NOT NULL
    )
    SELECT 1
    FROM quote_deal_candidates
    GROUP BY quote_id
    HAVING COUNT(DISTINCT deal_id) > 1
  ) THEN
    RAISE EXCEPTION 'Phase 19 backfill failed: one or more fx_quotes resolve to multiple canonical deals';
  END IF;
END
$$;
--> statement-breakpoint
WITH quote_deal_candidates AS (
  SELECT DISTINCT
    cs.fx_quote_id AS quote_id,
    d.id AS deal_id
  FROM calculation_snapshots cs
  INNER JOIN calculations c
    ON c.id = cs.calculation_id
  INNER JOIN deals d
    ON d.calculation_id = c.id
  WHERE cs.fx_quote_id IS NOT NULL
),
resolved_quote_deals AS (
  SELECT
    quote_id,
    MIN(deal_id::text)::uuid AS deal_id
  FROM quote_deal_candidates
  GROUP BY quote_id
  HAVING COUNT(DISTINCT deal_id) = 1
)
UPDATE fx_quotes q
SET deal_id = rqd.deal_id
FROM resolved_quote_deals rqd
WHERE q.id = rqd.quote_id
  AND q.deal_id IS NULL;
--> statement-breakpoint
WITH parsed_refs AS (
  SELECT
    q.id AS quote_id,
    CASE
      WHEN q.used_by_ref ~ '^(invoice|fx_execute):[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-8][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$'
        THEN split_part(q.used_by_ref, ':', 2)::uuid
      ELSE NULL
    END AS document_id
  FROM fx_quotes q
  WHERE q.used_by_ref IS NOT NULL
),
resolved_refs AS (
  SELECT
    pr.quote_id,
    d.id AS document_id
  FROM parsed_refs pr
  INNER JOIN documents d
    ON d.id = pr.document_id
)
UPDATE fx_quotes q
SET used_document_id = rr.document_id
FROM resolved_refs rr
WHERE q.id = rr.quote_id
  AND q.used_document_id IS NULL;
--> statement-breakpoint
WITH quote_ref_candidates AS (
  SELECT
    d.id AS document_id,
    q.deal_id
  FROM documents d
  INNER JOIN fx_quotes q
    ON q.id::text = d.payload->>'quoteRef'
    OR q.idempotency_key = d.payload->>'quoteRef'
    OR q.id::text = d.payload->'quoteSnapshot'->>'quoteRef'
    OR q.idempotency_key = d.payload->'quoteSnapshot'->>'quoteRef'
    OR q.id::text = d.payload->'quoteSnapshot'->>'quoteId'
  WHERE q.deal_id IS NOT NULL
),
resolved_quote_ref_candidates AS (
  SELECT
    document_id,
    MIN(deal_id::text)::uuid AS deal_id
  FROM quote_ref_candidates
  GROUP BY document_id
  HAVING COUNT(DISTINCT deal_id) = 1
)
INSERT INTO document_business_links (document_id, deal_id, link_kind)
SELECT
  document_id,
  deal_id,
  'deal_formal_document'
FROM resolved_quote_ref_candidates
ON CONFLICT ("document_id") DO NOTHING;
--> statement-breakpoint
WITH payload_parent_refs AS (
  SELECT
    d.id AS document_id,
    CASE
      WHEN d.payload->>'invoiceDocumentId' ~ '^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-8][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$'
        THEN (d.payload->>'invoiceDocumentId')::uuid
      WHEN d.payload->>'fxExecuteDocumentId' ~ '^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-8][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$'
        THEN (d.payload->>'fxExecuteDocumentId')::uuid
      ELSE NULL
    END AS parent_document_id
  FROM documents d
),
payload_parent_candidates AS (
  SELECT
    ppr.document_id,
    dbl.deal_id
  FROM payload_parent_refs ppr
  INNER JOIN document_business_links dbl
    ON dbl.document_id = ppr.parent_document_id
  WHERE ppr.parent_document_id IS NOT NULL
),
resolved_payload_parent_candidates AS (
  SELECT
    document_id,
    MIN(deal_id::text)::uuid AS deal_id
  FROM payload_parent_candidates
  GROUP BY document_id
  HAVING COUNT(DISTINCT deal_id) = 1
)
INSERT INTO document_business_links (document_id, deal_id, link_kind)
SELECT
  document_id,
  deal_id,
  'deal_formal_document'
FROM resolved_payload_parent_candidates
ON CONFLICT ("document_id") DO NOTHING;
--> statement-breakpoint
WITH RECURSIVE document_graph AS (
  SELECT
    dbl.document_id,
    dbl.deal_id
  FROM document_business_links dbl
  UNION
  SELECT
    CASE
      WHEN dl.from_document_id = dg.document_id THEN dl.to_document_id
      ELSE dl.from_document_id
    END AS document_id,
    dg.deal_id
  FROM document_graph dg
  INNER JOIN document_links dl
    ON dl.from_document_id = dg.document_id
    OR dl.to_document_id = dg.document_id
),
resolved_document_graph AS (
  SELECT
    document_id,
    MIN(deal_id::text)::uuid AS deal_id
  FROM document_graph
  GROUP BY document_id
  HAVING COUNT(DISTINCT deal_id) = 1
)
INSERT INTO document_business_links (document_id, deal_id, link_kind)
SELECT
  document_id,
  deal_id,
  'deal_formal_document'
FROM resolved_document_graph
ON CONFLICT ("document_id") DO NOTHING;
--> statement-breakpoint
UPDATE fx_quotes q
SET deal_id = dbl.deal_id
FROM document_business_links dbl
WHERE q.used_document_id = dbl.document_id
  AND q.deal_id IS NULL;
