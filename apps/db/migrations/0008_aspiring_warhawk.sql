ALTER TABLE "agreements"
  ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint

ALTER TABLE "ops_contracts"
  ADD COLUMN "agreement_id" uuid;--> statement-breakpoint

ALTER TABLE "ops_contracts"
  ADD CONSTRAINT "ops_contracts_agreement_id_agreements_id_fk"
  FOREIGN KEY ("agreement_id")
  REFERENCES "public"."agreements"("id")
  ON DELETE no action
  ON UPDATE no action;--> statement-breakpoint

CREATE TEMP TABLE phase13_contract_backfill AS
WITH ranked AS (
  SELECT
    c.id AS contract_id,
    oc.customer_id,
    oao.organization_id,
    c.organization_requisite_id,
    NULLIF(BTRIM(c.contract_number), '') AS contract_number,
    NULLIF(BTRIM(c.contract_date), '') AS contract_date_text,
    NULLIF(BTRIM(c.agent_fee), '') AS agent_fee_text,
    NULLIF(BTRIM(c.fixed_fee), '') AS fixed_fee_text,
    COALESCE(c.created_at, now()) AS created_at_ts,
    COALESCE(
      c.updated_at,
      c.created_at,
      now()
    ) AS updated_at_ts,
    ROW_NUMBER() OVER (
      PARTITION BY oc.customer_id
      ORDER BY
        c.updated_at DESC NULLS LAST,
        c.created_at DESC NULLS LAST,
        c.id DESC
    ) AS row_no
  FROM "ops_contracts" c
  INNER JOIN "ops_clients" oc
    ON oc.id = c.client_id
  INNER JOIN "ops_agent_organizations" oao
    ON oao.id = c.agent_organization_id
  WHERE c.is_active = true
)
SELECT
  gen_random_uuid() AS agreement_id,
  gen_random_uuid() AS version_id,
  contract_id,
  customer_id,
  organization_id,
  organization_requisite_id,
  contract_number,
  contract_date_text,
  agent_fee_text,
  fixed_fee_text,
  created_at_ts,
  updated_at_ts
FROM ranked
WHERE row_no = 1;--> statement-breakpoint

DO $$
DECLARE
  missing_customer integer;
  missing_organization integer;
  missing_requisite integer;
  malformed_agent_fee integer;
  malformed_fixed_fee integer;
  usd_currency_id uuid;
BEGIN
  SELECT COUNT(*) INTO missing_customer
  FROM phase13_contract_backfill
  WHERE customer_id IS NULL;

  IF missing_customer > 0 THEN
    RAISE EXCEPTION
      'Phase 13 backfill failed: % selected legacy contract rows have no canonical customer_id',
      missing_customer;
  END IF;

  SELECT COUNT(*) INTO missing_organization
  FROM phase13_contract_backfill
  WHERE organization_id IS NULL;

  IF missing_organization > 0 THEN
    RAISE EXCEPTION
      'Phase 13 backfill failed: % selected legacy contract rows have no canonical organization_id',
      missing_organization;
  END IF;

  SELECT COUNT(*) INTO missing_requisite
  FROM phase13_contract_backfill
  WHERE organization_requisite_id IS NULL;

  IF missing_requisite > 0 THEN
    RAISE EXCEPTION
      'Phase 13 backfill failed: % selected legacy contract rows have no organization_requisite_id',
      missing_requisite;
  END IF;

  SELECT COUNT(*) INTO malformed_agent_fee
  FROM phase13_contract_backfill
  WHERE agent_fee_text IS NOT NULL
    AND agent_fee_text !~ '^\d+(\.\d+)?$';

  IF malformed_agent_fee > 0 THEN
    RAISE EXCEPTION
      'Phase 13 backfill failed: % selected legacy contract rows have malformed agentFee values',
      malformed_agent_fee;
  END IF;

  SELECT COUNT(*) INTO malformed_fixed_fee
  FROM phase13_contract_backfill
  WHERE fixed_fee_text IS NOT NULL
    AND fixed_fee_text !~ '^\d+(\.\d+)?$';

  IF malformed_fixed_fee > 0 THEN
    RAISE EXCEPTION
      'Phase 13 backfill failed: % selected legacy contract rows have malformed fixedFee values',
      malformed_fixed_fee;
  END IF;

  SELECT id INTO usd_currency_id
  FROM "currencies"
  WHERE code = 'USD'
  LIMIT 1;

  IF usd_currency_id IS NULL THEN
    RAISE EXCEPTION 'Phase 13 backfill failed: USD currency is missing';
  END IF;
END $$;--> statement-breakpoint

INSERT INTO "agreements" (
  "id",
  "customer_id",
  "organization_id",
  "organization_requisite_id",
  "is_active",
  "current_version_id",
  "created_at",
  "updated_at"
)
SELECT
  agreement_id,
  customer_id,
  organization_id,
  organization_requisite_id,
  true,
  NULL,
  created_at_ts,
  updated_at_ts
FROM phase13_contract_backfill;--> statement-breakpoint

INSERT INTO "agreement_versions" (
  "id",
  "agreement_id",
  "version_number",
  "contract_number",
  "contract_date",
  "created_at",
  "updated_at"
)
SELECT
  version_id,
  agreement_id,
  1,
  contract_number,
  CASE
    WHEN contract_date_text IS NULL THEN NULL
    ELSE contract_date_text::date
  END,
  created_at_ts,
  updated_at_ts
FROM phase13_contract_backfill;--> statement-breakpoint

INSERT INTO "agreement_parties" (
  "id",
  "agreement_version_id",
  "party_role",
  "customer_id",
  "organization_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  version_id,
  'customer',
  customer_id,
  NULL,
  created_at_ts,
  updated_at_ts
FROM phase13_contract_backfill;--> statement-breakpoint

INSERT INTO "agreement_parties" (
  "id",
  "agreement_version_id",
  "party_role",
  "customer_id",
  "organization_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  version_id,
  'organization',
  NULL,
  organization_id,
  created_at_ts,
  updated_at_ts
FROM phase13_contract_backfill;--> statement-breakpoint

INSERT INTO "agreement_fee_rules" (
  "id",
  "agreement_version_id",
  "kind",
  "unit",
  "value_numeric",
  "currency_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  version_id,
  'agent_fee',
  'bps',
  (agent_fee_text::numeric * 100),
  NULL,
  created_at_ts,
  updated_at_ts
FROM phase13_contract_backfill
WHERE agent_fee_text IS NOT NULL;--> statement-breakpoint

INSERT INTO "agreement_fee_rules" (
  "id",
  "agreement_version_id",
  "kind",
  "unit",
  "value_numeric",
  "currency_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  version_id,
  'fixed_fee',
  'money',
  fixed_fee_text::numeric,
  (
    SELECT id
    FROM "currencies"
    WHERE code = 'USD'
    LIMIT 1
  ),
  created_at_ts,
  updated_at_ts
FROM phase13_contract_backfill
WHERE fixed_fee_text IS NOT NULL;--> statement-breakpoint

UPDATE "agreements" a
SET
  "current_version_id" = b.version_id,
  "updated_at" = GREATEST(a.updated_at, b.updated_at_ts)
FROM phase13_contract_backfill b
WHERE a.id = b.agreement_id;--> statement-breakpoint

UPDATE "ops_contracts" c
SET "agreement_id" = b.agreement_id
FROM phase13_contract_backfill b
WHERE c.id = b.contract_id;--> statement-breakpoint

CREATE UNIQUE INDEX "ops_contracts_agreement_id_uq"
  ON "ops_contracts" USING btree ("agreement_id")
  WHERE "agreement_id" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "agreements_active_customer_uq"
  ON "agreements" USING btree ("customer_id")
  WHERE "is_active" = true;--> statement-breakpoint
