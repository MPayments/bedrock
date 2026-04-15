ALTER TABLE "deals"
  ADD COLUMN IF NOT EXISTS "header_revision" integer,
  ADD COLUMN IF NOT EXISTS "header_snapshot" jsonb;
--> statement-breakpoint

ALTER TABLE "deals"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE text USING "status"::text,
  ALTER COLUMN "type" TYPE text USING "type"::text;
--> statement-breakpoint
ALTER TABLE "route_templates"
  ALTER COLUMN "deal_type" TYPE text USING "deal_type"::text;
--> statement-breakpoint
ALTER TABLE "deal_timeline_events"
  ALTER COLUMN "type" TYPE text USING "type"::text;
--> statement-breakpoint

UPDATE "deals"
SET "status" = CASE "status"
  WHEN 'draft' THEN 'draft'
  WHEN 'submitted' THEN CASE
    WHEN "calculation_id" IS NULL THEN 'pricing'
    ELSE 'quoted'
  END
  WHEN 'preparing_documents' THEN 'approved_for_execution'
  WHEN 'awaiting_funds' THEN 'approved_for_execution'
  WHEN 'awaiting_payment' THEN 'executing'
  WHEN 'closing_documents' THEN 'reconciling'
  WHEN 'done' THEN 'closed'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'rejected' THEN 'rejected'
  ELSE 'failed'
END;
--> statement-breakpoint

UPDATE "deal_timeline_events"
SET "type" = CASE "type"
  WHEN 'intake_saved' THEN 'deal_header_updated'
  WHEN 'quote_accepted' THEN 'calculation_accepted'
  ELSE "type"
END;
--> statement-breakpoint

CREATE TYPE "public"."deal_status_next" AS ENUM(
  'draft',
  'pricing',
  'quoted',
  'awaiting_customer_approval',
  'awaiting_internal_approval',
  'approved_for_execution',
  'executing',
  'partially_executed',
  'executed',
  'reconciling',
  'closed',
  'cancelled',
  'rejected',
  'expired',
  'failed'
);
--> statement-breakpoint
CREATE TYPE "public"."deal_type_next" AS ENUM(
  'payment',
  'currency_exchange',
  'currency_transit',
  'exporter_settlement',
  'internal_treasury'
);
--> statement-breakpoint
CREATE TYPE "public"."deal_timeline_event_type_next" AS ENUM(
  'deal_created',
  'deal_header_updated',
  'deal_approved',
  'deal_rejected',
  'participant_changed',
  'status_changed',
  'leg_state_changed',
  'execution_requested',
  'leg_operation_created',
  'instruction_prepared',
  'instruction_submitted',
  'instruction_settled',
  'instruction_failed',
  'instruction_retried',
  'instruction_voided',
  'return_requested',
  'instruction_returned',
  'deal_closed',
  'quote_created',
  'quote_expired',
  'quote_used',
  'calculation_attached',
  'calculation_created',
  'calculation_accepted',
  'calculation_superseded',
  'attachment_uploaded',
  'attachment_deleted',
  'attachment_ingested',
  'attachment_ingestion_failed',
  'document_created',
  'document_status_changed'
);
--> statement-breakpoint

ALTER TABLE "deals"
  ALTER COLUMN "status" TYPE "public"."deal_status_next"
    USING "status"::"public"."deal_status_next",
  ALTER COLUMN "type" TYPE "public"."deal_type_next"
    USING "type"::"public"."deal_type_next";
--> statement-breakpoint
ALTER TABLE "route_templates"
  ALTER COLUMN "deal_type" TYPE "public"."deal_type_next"
    USING "deal_type"::"public"."deal_type_next";
--> statement-breakpoint
ALTER TABLE "deal_timeline_events"
  ALTER COLUMN "type" TYPE "public"."deal_timeline_event_type_next"
    USING "type"::"public"."deal_timeline_event_type_next";
--> statement-breakpoint

DROP TYPE "public"."deal_status";
--> statement-breakpoint
ALTER TYPE "public"."deal_status_next" RENAME TO "deal_status";
--> statement-breakpoint
DROP TYPE "public"."deal_type";
--> statement-breakpoint
ALTER TYPE "public"."deal_type_next" RENAME TO "deal_type";
--> statement-breakpoint
DROP TYPE "public"."deal_timeline_event_type";
--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type_next" RENAME TO "deal_timeline_event_type";
--> statement-breakpoint

ALTER TABLE "deals"
  ALTER COLUMN "status" SET DEFAULT 'draft';
--> statement-breakpoint

UPDATE "deals" AS deal
SET
  "header_revision" = snapshot."revision",
  "header_snapshot" = snapshot."snapshot"
FROM "deal_intake_snapshots" AS snapshot
WHERE snapshot."deal_id" = deal."id"
  AND deal."header_snapshot" IS NULL;
--> statement-breakpoint

UPDATE "deals"
SET "header_revision" = 1
WHERE "header_revision" IS NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "deals"
    WHERE "header_snapshot" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Route composer cutover requires header_snapshot for every deal before dropping legacy intake storage';
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "deals"
  ALTER COLUMN "header_revision" SET DEFAULT 1,
  ALTER COLUMN "header_revision" SET NOT NULL,
  ALTER COLUMN "header_snapshot" SET NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "deals_header_revision_idx"
  ON "deals" USING btree ("header_revision");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_header_applicant_idx"
  ON "deals" USING btree (((header_snapshot -> 'common' ->> 'applicantCounterpartyId')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_header_invoice_idx"
  ON "deals" USING btree (((header_snapshot -> 'incomingReceipt' ->> 'invoiceNumber')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_header_contract_idx"
  ON "deals" USING btree (((header_snapshot -> 'incomingReceipt' ->> 'contractNumber')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_header_requested_execution_idx"
  ON "deals" USING btree (((header_snapshot -> 'common' ->> 'requestedExecutionDate')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_header_expected_at_idx"
  ON "deals" USING btree (((header_snapshot -> 'incomingReceipt' ->> 'expectedAt')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_header_payer_idx"
  ON "deals" USING btree (((header_snapshot -> 'incomingReceipt' ->> 'payerCounterpartyId')));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_header_beneficiary_idx"
  ON "deals" USING btree (((header_snapshot -> 'externalBeneficiary' ->> 'beneficiaryCounterpartyId')));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "treasury_execution_fills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "operation_id" uuid NOT NULL REFERENCES "public"."treasury_operations"("id") ON DELETE no action ON UPDATE no action,
  "deal_id" uuid,
  "route_version_id" uuid,
  "route_leg_id" uuid,
  "calculation_snapshot_id" uuid,
  "instruction_id" uuid,
  "source_kind" text NOT NULL,
  "source_ref" text NOT NULL,
  "executed_at" timestamp with time zone NOT NULL,
  "confirmed_at" timestamp with time zone,
  "sold_amount_minor" bigint,
  "sold_currency_id" uuid REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action,
  "bought_amount_minor" bigint,
  "bought_currency_id" uuid REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action,
  "actual_rate_num" bigint,
  "actual_rate_den" bigint,
  "fill_sequence" bigint,
  "provider_counterparty_id" uuid,
  "provider_ref" text,
  "external_record_id" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "treasury_execution_fills_source_ref_uq"
  ON "treasury_execution_fills" USING btree ("source_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fills_operation_idx"
  ON "treasury_execution_fills" USING btree ("operation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fills_deal_idx"
  ON "treasury_execution_fills" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fills_route_version_idx"
  ON "treasury_execution_fills" USING btree ("route_version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fills_route_leg_idx"
  ON "treasury_execution_fills" USING btree ("route_leg_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fills_instruction_idx"
  ON "treasury_execution_fills" USING btree ("instruction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fills_source_kind_idx"
  ON "treasury_execution_fills" USING btree ("source_kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fills_executed_at_idx"
  ON "treasury_execution_fills" USING btree ("executed_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "treasury_execution_fees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "operation_id" uuid NOT NULL REFERENCES "public"."treasury_operations"("id") ON DELETE no action ON UPDATE no action,
  "deal_id" uuid,
  "route_version_id" uuid,
  "route_leg_id" uuid,
  "calculation_snapshot_id" uuid,
  "instruction_id" uuid,
  "fill_id" uuid REFERENCES "public"."treasury_execution_fills"("id") ON DELETE no action ON UPDATE no action,
  "source_kind" text NOT NULL,
  "source_ref" text NOT NULL,
  "charged_at" timestamp with time zone NOT NULL,
  "confirmed_at" timestamp with time zone,
  "fee_family" text NOT NULL,
  "amount_minor" bigint,
  "currency_id" uuid REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action,
  "route_component_id" uuid,
  "component_code" text,
  "provider_counterparty_id" uuid,
  "provider_ref" text,
  "external_record_id" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "treasury_execution_fees_source_ref_uq"
  ON "treasury_execution_fees" USING btree ("source_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_operation_idx"
  ON "treasury_execution_fees" USING btree ("operation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_deal_idx"
  ON "treasury_execution_fees" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_route_version_idx"
  ON "treasury_execution_fees" USING btree ("route_version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_route_leg_idx"
  ON "treasury_execution_fees" USING btree ("route_leg_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_instruction_idx"
  ON "treasury_execution_fees" USING btree ("instruction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_fill_idx"
  ON "treasury_execution_fees" USING btree ("fill_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_source_kind_idx"
  ON "treasury_execution_fees" USING btree ("source_kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_execution_fees_charged_at_idx"
  ON "treasury_execution_fees" USING btree ("charged_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "treasury_cash_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "operation_id" uuid NOT NULL REFERENCES "public"."treasury_operations"("id") ON DELETE no action ON UPDATE no action,
  "deal_id" uuid,
  "route_version_id" uuid,
  "route_leg_id" uuid,
  "calculation_snapshot_id" uuid,
  "instruction_id" uuid,
  "source_kind" text NOT NULL,
  "source_ref" text NOT NULL,
  "direction" text NOT NULL,
  "amount_minor" bigint,
  "currency_id" uuid REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action,
  "booked_at" timestamp with time zone NOT NULL,
  "value_date" timestamp with time zone,
  "account_ref" text,
  "requisite_id" uuid,
  "provider_counterparty_id" uuid,
  "provider_ref" text,
  "statement_ref" text,
  "external_record_id" text,
  "notes" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "treasury_cash_movements_source_ref_uq"
  ON "treasury_cash_movements" USING btree ("source_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_cash_movements_operation_idx"
  ON "treasury_cash_movements" USING btree ("operation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_cash_movements_deal_idx"
  ON "treasury_cash_movements" USING btree ("deal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_cash_movements_route_version_idx"
  ON "treasury_cash_movements" USING btree ("route_version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_cash_movements_route_leg_idx"
  ON "treasury_cash_movements" USING btree ("route_leg_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_cash_movements_instruction_idx"
  ON "treasury_cash_movements" USING btree ("instruction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_cash_movements_source_kind_idx"
  ON "treasury_cash_movements" USING btree ("source_kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treasury_cash_movements_booked_at_idx"
  ON "treasury_cash_movements" USING btree ("booked_at");
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'treasury_operation_facts'
  ) THEN
    INSERT INTO "treasury_execution_fills" (
      "id",
      "operation_id",
      "deal_id",
      "route_leg_id",
      "instruction_id",
      "source_kind",
      "source_ref",
      "executed_at",
      "confirmed_at",
      "sold_amount_minor",
      "sold_currency_id",
      "bought_amount_minor",
      "bought_currency_id",
      "provider_ref",
      "external_record_id",
      "notes",
      "metadata",
      "created_at",
      "updated_at"
    )
    SELECT
      gen_random_uuid(),
      fact."operation_id",
      fact."deal_id",
      fact."route_leg_id",
      fact."instruction_id",
      fact."source_kind",
      fact."source_ref" || ':fill',
      fact."recorded_at",
      fact."confirmed_at",
      fact."amount_minor",
      fact."currency_id",
      fact."counter_amount_minor",
      fact."counter_currency_id",
      fact."provider_ref",
      fact."external_record_id",
      fact."notes",
      fact."metadata",
      fact."created_at",
      fact."updated_at"
    FROM "treasury_operation_facts" AS fact
    WHERE fact."amount_minor" IS NOT NULL
       OR fact."counter_amount_minor" IS NOT NULL;

    INSERT INTO "treasury_execution_fees" (
      "id",
      "operation_id",
      "deal_id",
      "route_leg_id",
      "instruction_id",
      "source_kind",
      "source_ref",
      "charged_at",
      "confirmed_at",
      "fee_family",
      "amount_minor",
      "currency_id",
      "provider_ref",
      "external_record_id",
      "notes",
      "metadata",
      "created_at",
      "updated_at"
    )
    SELECT
      gen_random_uuid(),
      fact."operation_id",
      fact."deal_id",
      fact."route_leg_id",
      fact."instruction_id",
      fact."source_kind",
      fact."source_ref" || ':fee',
      COALESCE(fact."confirmed_at", fact."recorded_at"),
      fact."confirmed_at",
      COALESCE(NULLIF(fact."metadata" ->> 'feeFamily', ''), 'provider_fee'),
      fact."fee_amount_minor",
      fact."fee_currency_id",
      fact."provider_ref",
      fact."external_record_id",
      fact."notes",
      fact."metadata",
      fact."created_at",
      fact."updated_at"
    FROM "treasury_operation_facts" AS fact
    WHERE fact."fee_amount_minor" IS NOT NULL;

    INSERT INTO "treasury_cash_movements" (
      "id",
      "operation_id",
      "deal_id",
      "route_leg_id",
      "instruction_id",
      "source_kind",
      "source_ref",
      "direction",
      "amount_minor",
      "currency_id",
      "booked_at",
      "value_date",
      "account_ref",
      "provider_ref",
      "statement_ref",
      "external_record_id",
      "notes",
      "metadata",
      "created_at",
      "updated_at"
    )
    SELECT
      gen_random_uuid(),
      fact."operation_id",
      fact."deal_id",
      fact."route_leg_id",
      fact."instruction_id",
      fact."source_kind",
      fact."source_ref" || ':cash',
      fact."metadata" ->> 'direction',
      fact."amount_minor",
      fact."currency_id",
      fact."recorded_at",
      fact."confirmed_at",
      fact."metadata" ->> 'accountRef',
      fact."provider_ref",
      fact."metadata" ->> 'statementRef',
      fact."external_record_id",
      fact."notes",
      fact."metadata",
      fact."created_at",
      fact."updated_at"
    FROM "treasury_operation_facts" AS fact
    WHERE fact."amount_minor" IS NOT NULL
      AND (fact."metadata" ->> 'direction') IN ('credit', 'debit');
  END IF;
END
$$;
--> statement-breakpoint

DROP TABLE IF EXISTS "deal_quote_acceptances" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "deal_intake_snapshots" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "treasury_operation_facts" CASCADE;
