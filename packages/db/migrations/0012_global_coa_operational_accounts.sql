ALTER TABLE "account_providers" RENAME TO "operational_account_providers";--> statement-breakpoint
ALTER INDEX "account_providers_name_uq" RENAME TO "operational_account_providers_name_uq";--> statement-breakpoint

ALTER TABLE "accounts" RENAME TO "operational_accounts";--> statement-breakpoint
ALTER INDEX "accounts_counterparty_stable_uq" RENAME TO "operational_accounts_counterparty_stable_uq";--> statement-breakpoint
ALTER INDEX "accounts_counterparty_cur_idx" RENAME TO "operational_accounts_counterparty_cur_idx";--> statement-breakpoint

ALTER TABLE "operational_account_bindings" RENAME TO "operational_accounts_book_bindings";--> statement-breakpoint
ALTER TABLE "operational_accounts_book_bindings" RENAME COLUMN "account_id" TO "operational_account_id";--> statement-breakpoint
ALTER TABLE "operational_accounts_book_bindings" DROP CONSTRAINT IF EXISTS "operational_account_bindings_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "operational_accounts_book_bindings" DROP CONSTRAINT IF EXISTS "operational_accounts_book_bindings_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "operational_accounts_book_bindings" ADD CONSTRAINT "operational_accounts_book_bindings_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_accounts_book_bindings" DROP CONSTRAINT IF EXISTS "operational_account_bindings_book_account_id_book_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "operational_accounts_book_bindings" DROP CONSTRAINT IF EXISTS "operational_accounts_book_bindings_book_account_id_book_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "operational_accounts_book_bindings" ADD CONSTRAINT "operational_accounts_book_bindings_book_account_id_book_accounts_id_fk" FOREIGN KEY ("book_account_id") REFERENCES "public"."book_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER INDEX "operational_account_binding_book_idx" RENAME TO "operational_accounts_book_binding_book_idx";--> statement-breakpoint

ALTER TABLE "transfer_orders" DROP CONSTRAINT IF EXISTS "transfer_orders_source_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "transfer_orders" DROP CONSTRAINT IF EXISTS "transfer_orders_destination_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "transfer_orders" RENAME COLUMN "source_account_id" TO "source_operational_account_id";--> statement-breakpoint
ALTER TABLE "transfer_orders" RENAME COLUMN "destination_account_id" TO "destination_operational_account_id";--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_source_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("source_operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_destination_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("destination_operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_orders" DROP CONSTRAINT IF EXISTS "payment_orders_payin_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "payment_orders" DROP CONSTRAINT IF EXISTS "payment_orders_payout_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payin_account_id_operational_accounts_id_fk" FOREIGN KEY ("payin_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payout_account_id_operational_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chart_org_overrides'
  ) THEN
    CREATE TABLE IF NOT EXISTS "chart_org_overrides_archive" (
      "archived_at" timestamp with time zone NOT NULL DEFAULT now(),
      "org_id" uuid NOT NULL,
      "account_no" text NOT NULL,
      "enabled" boolean NOT NULL,
      "name_override" text,
      "created_at" timestamp with time zone NOT NULL,
      "updated_at" timestamp with time zone NOT NULL
    );

    INSERT INTO "chart_org_overrides_archive" (
      "archived_at",
      "org_id",
      "account_no",
      "enabled",
      "name_override",
      "created_at",
      "updated_at"
    )
    SELECT
      now(),
      "org_id",
      "account_no",
      "enabled",
      "name_override",
      "created_at",
      "updated_at"
    FROM "chart_org_overrides";

    DROP TABLE "chart_org_overrides";
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "chart_template_accounts" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "correspondence_rules_migration_audit" (
  "id" bigserial PRIMARY KEY,
  "recorded_at" timestamp with time zone NOT NULL DEFAULT now(),
  "posting_code" text NOT NULL,
  "debit_account_no" text NOT NULL,
  "credit_account_no" text NOT NULL,
  "enabled" boolean NOT NULL,
  "reason" text NOT NULL
);--> statement-breakpoint

DO $$
DECLARE
  has_scope boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'correspondence_rules'
      AND column_name = 'scope'
  )
  INTO has_scope;

  IF has_scope THEN
    INSERT INTO "correspondence_rules_migration_audit" (
      "posting_code",
      "debit_account_no",
      "credit_account_no",
      "enabled",
      "reason"
    )
    WITH canonical("posting_code","debit_account_no","credit_account_no") AS (
      VALUES
        ('TR.INTRA.IMMEDIATE', '1110', '1110'),
        ('TR.INTRA.PENDING', '1110', '1110'),
        ('TR.CROSS.SOURCE.IMMEDIATE', '1310', '1110'),
        ('TR.CROSS.DEST.IMMEDIATE', '1110', '1310'),
        ('TR.CROSS.SOURCE.PENDING', '1310', '1110'),
        ('TR.CROSS.DEST.PENDING', '1110', '1310'),
        ('TC.1001', '1110', '2110'),
        ('TC.2001', '2110', '2140'),
        ('TC.2005', '2140', '2130'),
        ('TC.2009', '2140', '1320'),
        ('TC.2010', '1320', '2140'),
        ('TC.3001', '2110', '4110'),
        ('TC.3002', '2110', '4120'),
        ('TC.3003', '2110', '2120'),
        ('TC.3006', '2110', '4130'),
        ('TC.3007', '5110', '2110'),
        ('TC.3008', '5120', '2120'),
        ('TC.3101', '2130', '1110'),
        ('TC.3011', '2120', '1110')
    )
    SELECT
      r."posting_code",
      r."debit_account_no",
      r."credit_account_no",
      r."enabled",
      CASE
        WHEN r."scope" <> 'global' OR r."org_id" IS NOT NULL
          THEN 'dropped_non_global_rule'
        ELSE 'dropped_non_canonical_rule'
      END
    FROM "correspondence_rules" r
    LEFT JOIN canonical c
      ON c."posting_code" = r."posting_code"
     AND c."debit_account_no" = r."debit_account_no"
     AND c."credit_account_no" = r."credit_account_no"
    WHERE c."posting_code" IS NULL
       OR r."scope" <> 'global'
       OR r."org_id" IS NOT NULL;

    ALTER TABLE "correspondence_rules" DROP CONSTRAINT IF EXISTS "correspondence_scope_org_ck";
  ELSE
    INSERT INTO "correspondence_rules_migration_audit" (
      "posting_code",
      "debit_account_no",
      "credit_account_no",
      "enabled",
      "reason"
    )
    WITH canonical("posting_code","debit_account_no","credit_account_no") AS (
      VALUES
        ('TR.INTRA.IMMEDIATE', '1110', '1110'),
        ('TR.INTRA.PENDING', '1110', '1110'),
        ('TR.CROSS.SOURCE.IMMEDIATE', '1310', '1110'),
        ('TR.CROSS.DEST.IMMEDIATE', '1110', '1310'),
        ('TR.CROSS.SOURCE.PENDING', '1310', '1110'),
        ('TR.CROSS.DEST.PENDING', '1110', '1310'),
        ('TC.1001', '1110', '2110'),
        ('TC.2001', '2110', '2140'),
        ('TC.2005', '2140', '2130'),
        ('TC.2009', '2140', '1320'),
        ('TC.2010', '1320', '2140'),
        ('TC.3001', '2110', '4110'),
        ('TC.3002', '2110', '4120'),
        ('TC.3003', '2110', '2120'),
        ('TC.3006', '2110', '4130'),
        ('TC.3007', '5110', '2110'),
        ('TC.3008', '5120', '2120'),
        ('TC.3101', '2130', '1110'),
        ('TC.3011', '2120', '1110')
    )
    SELECT
      r."posting_code",
      r."debit_account_no",
      r."credit_account_no",
      r."enabled",
      'dropped_non_canonical_rule'
    FROM "correspondence_rules" r
    LEFT JOIN canonical c
      ON c."posting_code" = r."posting_code"
     AND c."debit_account_no" = r."debit_account_no"
     AND c."credit_account_no" = r."credit_account_no"
    WHERE c."posting_code" IS NULL;
  END IF;
END $$;--> statement-breakpoint

DROP INDEX IF EXISTS "correspondence_rule_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "correspondence_rule_lookup_idx";--> statement-breakpoint
ALTER TABLE "correspondence_rules" DROP COLUMN IF EXISTS "scope";--> statement-breakpoint
ALTER TABLE "correspondence_rules" DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
CREATE UNIQUE INDEX "correspondence_rule_uq" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no");--> statement-breakpoint
CREATE INDEX "correspondence_rule_lookup_idx" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no","enabled");--> statement-breakpoint

DO $$
DECLARE
  duplicate_row record;
BEGIN
  WITH canonical("posting_code","debit_account_no","credit_account_no") AS (
    VALUES
      ('TR.INTRA.IMMEDIATE', '1110', '1110'),
      ('TR.INTRA.PENDING', '1110', '1110'),
      ('TR.CROSS.SOURCE.IMMEDIATE', '1310', '1110'),
      ('TR.CROSS.DEST.IMMEDIATE', '1110', '1310'),
      ('TR.CROSS.SOURCE.PENDING', '1310', '1110'),
      ('TR.CROSS.DEST.PENDING', '1110', '1310'),
      ('TC.1001', '1110', '2110'),
      ('TC.2001', '2110', '2140'),
      ('TC.2005', '2140', '2130'),
      ('TC.2009', '2140', '1320'),
      ('TC.2010', '1320', '2140'),
      ('TC.3001', '2110', '4110'),
      ('TC.3002', '2110', '4120'),
      ('TC.3003', '2110', '2120'),
      ('TC.3006', '2110', '4130'),
      ('TC.3007', '5110', '2110'),
      ('TC.3008', '5120', '2120'),
      ('TC.3101', '2130', '1110'),
      ('TC.3011', '2120', '1110')
  ),
  duplicates AS (
    SELECT "posting_code", "debit_account_no", "credit_account_no", count(*) AS c
    FROM canonical
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
  )
  SELECT *
  INTO duplicate_row
  FROM duplicates
  LIMIT 1;

  IF duplicate_row IS NOT NULL THEN
    RAISE EXCEPTION
      'Canonical correspondence matrix has internal duplicates: %/%/%',
      duplicate_row."posting_code",
      duplicate_row."debit_account_no",
      duplicate_row."credit_account_no";
  END IF;
END $$;--> statement-breakpoint

DELETE FROM "correspondence_rules";--> statement-breakpoint

INSERT INTO "correspondence_rules" (
  "posting_code",
  "debit_account_no",
  "credit_account_no",
  "enabled"
)
VALUES
  ('TR.INTRA.IMMEDIATE', '1110', '1110', true),
  ('TR.INTRA.PENDING', '1110', '1110', true),
  ('TR.CROSS.SOURCE.IMMEDIATE', '1310', '1110', true),
  ('TR.CROSS.DEST.IMMEDIATE', '1110', '1310', true),
  ('TR.CROSS.SOURCE.PENDING', '1310', '1110', true),
  ('TR.CROSS.DEST.PENDING', '1110', '1310', true),
  ('TC.1001', '1110', '2110', true),
  ('TC.2001', '2110', '2140', true),
  ('TC.2005', '2140', '2130', true),
  ('TC.2009', '2140', '1320', true),
  ('TC.2010', '1320', '2140', true),
  ('TC.3001', '2110', '4110', true),
  ('TC.3002', '2110', '4120', true),
  ('TC.3003', '2110', '2120', true),
  ('TC.3006', '2110', '4130', true),
  ('TC.3007', '5110', '2110', true),
  ('TC.3008', '5120', '2120', true),
  ('TC.3101', '2130', '1110', true),
  ('TC.3011', '2120', '1110', true);--> statement-breakpoint

INSERT INTO "chart_template_accounts" (
  "account_no",
  "name",
  "kind",
  "normal_side",
  "posting_allowed",
  "enabled",
  "parent_account_no"
)
VALUES
  ('1320', 'TREASURY_CLEARING', 'active_passive', 'both', true, true, '1300'),
  ('2140', 'ORDER_RESERVE', 'liability', 'credit', true, true, '2100'),
  ('5120', 'PROVIDER_FEE_EXPENSE', 'expense', 'debit', true, true, '5000')
ON CONFLICT ("account_no") DO UPDATE SET
  "name" = excluded."name",
  "kind" = excluded."kind",
  "normal_side" = excluded."normal_side",
  "posting_allowed" = excluded."posting_allowed",
  "enabled" = excluded."enabled",
  "parent_account_no" = excluded."parent_account_no";--> statement-breakpoint

UPDATE "chart_template_accounts"
SET "name" = 'INTERCOMPANY_NET'
WHERE "account_no" = '1310';--> statement-breakpoint

UPDATE "chart_template_accounts"
SET
  "posting_allowed" = false,
  "enabled" = false,
  "name" = 'Резерв по ордерам (deprecated)'
WHERE "account_no" = '1210';--> statement-breakpoint

DELETE FROM "chart_template_account_analytics"
WHERE "account_no" IN ('1110', '1310', '1320', '2120', '2140', '5120');--> statement-breakpoint

INSERT INTO "chart_template_account_analytics" (
  "account_no",
  "analytic_type",
  "required"
)
VALUES
  ('1110', 'operational_account_id', true),
  ('1310', 'counterparty_id', true),
  ('1320', 'order_id', true),
  ('1320', 'counterparty_id', true),
  ('1320', 'quote_id', false),
  ('2120', 'fee_bucket', true),
  ('2120', 'order_id', true),
  ('2120', 'counterparty_id', false),
  ('2120', 'quote_id', false),
  ('2140', 'order_id', true),
  ('2140', 'customer_id', false),
  ('2140', 'quote_id', false),
  ('5120', 'fee_bucket', true),
  ('5120', 'order_id', true),
  ('5120', 'counterparty_id', false),
  ('5120', 'quote_id', false)
ON CONFLICT ("account_no","analytic_type") DO UPDATE SET
  "required" = excluded."required";--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'fee_accounting_treatment'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."fee_accounting_treatment" AS ENUM ('income', 'pass_through', 'expense');
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "fee_rules" ADD COLUMN IF NOT EXISTS "accounting_treatment" text;--> statement-breakpoint
UPDATE "fee_rules"
SET "accounting_treatment" =
  CASE
    WHEN "settlement_mode" = 'separate_payment_order' THEN 'pass_through'
    ELSE 'income'
  END
WHERE "accounting_treatment" IS NULL;--> statement-breakpoint
ALTER TABLE "fee_rules" ALTER COLUMN "accounting_treatment" SET DEFAULT 'income';--> statement-breakpoint
ALTER TABLE "fee_rules" ALTER COLUMN "accounting_treatment" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "fee_payment_orders" ADD COLUMN IF NOT EXISTS "payout_operational_account_id" uuid;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD COLUMN IF NOT EXISTS "accounting_treatment" "fee_accounting_treatment";--> statement-breakpoint

UPDATE "fee_payment_orders" f
SET "payout_operational_account_id" = p."payout_account_id"
FROM "payment_orders" p
WHERE p."id" = f."parent_order_id"
  AND f."payout_operational_account_id" IS NULL;--> statement-breakpoint

UPDATE "fee_payment_orders"
SET "accounting_treatment" = 'pass_through'
WHERE "accounting_treatment" IS NULL;--> statement-breakpoint

ALTER TABLE "fee_payment_orders" DROP COLUMN IF EXISTS "payout_bank_stable_key";--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ALTER COLUMN "payout_operational_account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ALTER COLUMN "accounting_treatment" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_payout_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("payout_operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

DROP TYPE IF EXISTS "public"."correspondence_scope";--> statement-breakpoint
