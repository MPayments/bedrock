CREATE TYPE "public"."deal_leg_manual_override" AS ENUM('blocked', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'leg_manual_override_set' BEFORE 'execution_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'leg_manual_override_cleared' BEFORE 'execution_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_outcome_recorded' BEFORE 'return_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_artifact_attached' BEFORE 'return_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'deal_leg_amended' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'deal_route_template_swapped' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'acceptance_revoked_by_operator' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'reconciliation_exception_resolved';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'materialization_failed';--> statement-breakpoint
CREATE TABLE "deal_pricing_contexts" (
	"deal_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_step_artifacts" (
	"payment_step_id" uuid NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_step_artifacts_pk" PRIMARY KEY("payment_step_id","file_asset_id","purpose")
);
--> statement-breakpoint
CREATE TABLE "payment_step_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_step_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"provider_ref" text,
	"provider_snapshot" jsonb,
	"submitted_at" timestamp with time zone NOT NULL,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"outcome_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_step_returns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_step_id" uuid NOT NULL,
	"amount_minor" bigint,
	"currency_id" uuid,
	"provider_ref" text,
	"reason" text,
	"returned_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"source_ref" text NOT NULL,
	"origin" jsonb NOT NULL,
	"deal_id" uuid,
	"treasury_batch_id" uuid,
	"treasury_order_id" uuid,
	"quote_id" uuid,
	"from_party_id" uuid NOT NULL,
	"from_requisite_id" uuid,
	"to_party_id" uuid NOT NULL,
	"to_requisite_id" uuid,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"from_amount_minor" bigint,
	"to_amount_minor" bigint,
	"rate_value" text,
	"rate_locked_side" text,
	"planned_route" jsonb NOT NULL,
	"current_route" jsonb NOT NULL,
	"amendments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"postings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_executions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_ref" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"origin" jsonb NOT NULL,
	"deal_id" uuid,
	"treasury_order_id" uuid,
	"quote_id" uuid NOT NULL,
	"quote_leg_idx" integer,
	"quote_snapshot" jsonb,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"from_amount_minor" bigint NOT NULL,
	"to_amount_minor" bigint NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"provider_ref" text,
	"provider_snapshot" jsonb,
	"posting_document_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_order_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"source_ref" text NOT NULL,
	"payment_step_id" uuid,
	"quote_execution_id" uuid,
	"quote_id" uuid,
	"from_party_id" uuid NOT NULL,
	"from_requisite_id" uuid,
	"to_party_id" uuid NOT NULL,
	"to_requisite_id" uuid,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"from_amount_minor" bigint,
	"to_amount_minor" bigint,
	"rate" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"description" text,
	"activated_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_leg_operation_links" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal_operational_positions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treasury_instructions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treasury_operations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "deal_leg_operation_links" CASCADE;--> statement-breakpoint
DROP TABLE "deal_operational_positions" CASCADE;--> statement-breakpoint
DROP TABLE "treasury_instructions" CASCADE;--> statement-breakpoint
DROP TABLE "treasury_operations" CASCADE;--> statement-breakpoint
ALTER TABLE "file_links" DROP CONSTRAINT "file_links_exactly_one_owner_chk";--> statement-breakpoint
ALTER TABLE "file_links" DROP CONSTRAINT "file_links_generated_variant_shape_chk";--> statement-breakpoint
ALTER TABLE "reconciliation_matches" DROP CONSTRAINT IF EXISTS "reconciliation_matches_matched_treasury_operation_id_treasury_operations_id_fk";
--> statement-breakpoint
DROP INDEX "file_links_generated_deal_variant_uq";--> statement-breakpoint
DROP INDEX "file_links_generated_counterparty_variant_uq";--> statement-breakpoint
ALTER TABLE "file_links" ALTER COLUMN "link_kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."file_link_kind";--> statement-breakpoint
CREATE TYPE "public"."file_link_kind" AS ENUM('deal_attachment', 'legal_entity_attachment', 'agreement_signed_contract', 'payment_step_evidence');--> statement-breakpoint
ALTER TABLE "file_links" ALTER COLUMN "link_kind" SET DATA TYPE "public"."file_link_kind" USING "link_kind"::"public"."file_link_kind";--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "manual_override_state" "deal_leg_manual_override";--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "override_reason_code" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "override_comment" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "route_snapshot_leg_id" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "from_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "to_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_quote_acceptances" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "file_links" ADD COLUMN "agreement_version_id" uuid;--> statement-breakpoint
ALTER TABLE "file_links" ADD COLUMN "payment_step_id" uuid;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "pricing_fingerprint" text;--> statement-breakpoint
ALTER TABLE "payment_route_templates" ADD COLUMN "min_margin_bps" integer;--> statement-breakpoint
ALTER TABLE "payment_route_templates" ADD COLUMN "max_margin_bps" integer;--> statement-breakpoint
ALTER TABLE "deal_pricing_contexts" ADD CONSTRAINT "deal_pricing_contexts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_step_artifacts" ADD CONSTRAINT "payment_step_artifacts_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_step_attempts" ADD CONSTRAINT "payment_step_attempts_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_step_returns" ADD CONSTRAINT "payment_step_returns_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_step_returns" ADD CONSTRAINT "payment_step_returns_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD CONSTRAINT "payment_steps_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD CONSTRAINT "payment_steps_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_executions" ADD CONSTRAINT "quote_executions_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_executions" ADD CONSTRAINT "quote_executions_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_order_id_treasury_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."treasury_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_quote_execution_id_quote_executions_id_fk" FOREIGN KEY ("quote_execution_id") REFERENCES "public"."quote_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_order_steps" ADD CONSTRAINT "treasury_order_steps_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_pricing_contexts_revision_idx" ON "deal_pricing_contexts" USING btree ("revision");--> statement-breakpoint
CREATE INDEX "payment_step_artifacts_step_idx" ON "payment_step_artifacts" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_artifacts_step_purpose_idx" ON "payment_step_artifacts" USING btree ("payment_step_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_step_attempts_step_attempt_uq" ON "payment_step_attempts" USING btree ("payment_step_id","attempt_no");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_step_idx" ON "payment_step_attempts" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_outcome_idx" ON "payment_step_attempts" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_provider_ref_idx" ON "payment_step_attempts" USING btree ("provider_ref");--> statement-breakpoint
CREATE INDEX "payment_step_returns_step_idx" ON "payment_step_returns" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_returns_returned_at_idx" ON "payment_step_returns" USING btree ("returned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_steps_source_ref_uq" ON "payment_steps" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "payment_steps_purpose_idx" ON "payment_steps" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "payment_steps_kind_idx" ON "payment_steps" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "payment_steps_state_idx" ON "payment_steps" USING btree ("state");--> statement-breakpoint
CREATE INDEX "payment_steps_deal_idx" ON "payment_steps" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "payment_steps_batch_idx" ON "payment_steps" USING btree ("treasury_batch_id");--> statement-breakpoint
CREATE INDEX "payment_steps_order_idx" ON "payment_steps" USING btree ("treasury_order_id");--> statement-breakpoint
CREATE INDEX "payment_steps_scheduled_idx" ON "payment_steps" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_executions_source_ref_uq" ON "quote_executions" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "quote_executions_state_idx" ON "quote_executions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "quote_executions_deal_idx" ON "quote_executions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "quote_executions_order_idx" ON "quote_executions" USING btree ("treasury_order_id");--> statement-breakpoint
CREATE INDEX "quote_executions_quote_idx" ON "quote_executions" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_order_steps_order_sequence_uq" ON "treasury_order_steps" USING btree ("order_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_order_steps_source_ref_uq" ON "treasury_order_steps" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "treasury_order_steps_order_idx" ON "treasury_order_steps" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "treasury_order_steps_payment_step_idx" ON "treasury_order_steps" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "treasury_order_steps_quote_execution_idx" ON "treasury_order_steps" USING btree ("quote_execution_id");--> statement-breakpoint
CREATE INDEX "treasury_orders_type_idx" ON "treasury_orders" USING btree ("type");--> statement-breakpoint
CREATE INDEX "treasury_orders_state_idx" ON "treasury_orders" USING btree ("state");--> statement-breakpoint
CREATE INDEX "treasury_orders_created_at_idx" ON "treasury_orders" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_treasury_operation_id_payment_steps_id_fk" FOREIGN KEY ("matched_treasury_operation_id") REFERENCES "public"."payment_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_legs_deal_route_leg_idx" ON "deal_legs" USING btree ("deal_id","route_snapshot_leg_id");--> statement-breakpoint
CREATE INDEX "file_links_agreement_version_idx" ON "file_links" USING btree ("agreement_version_id");--> statement-breakpoint
CREATE INDEX "file_links_payment_step_idx" ON "file_links" USING btree ("payment_step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_agreement_signed_contract_uq" ON "file_links" USING btree ("agreement_version_id","link_kind") WHERE "file_links"."agreement_version_id" is not null and "file_links"."link_kind" = 'agreement_signed_contract';--> statement-breakpoint
CREATE INDEX "fx_quotes_deal_fingerprint_idx" ON "fx_quotes" USING btree ("deal_id","pricing_fingerprint");--> statement-breakpoint
ALTER TABLE "deal_legs" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_exactly_one_owner_chk" CHECK ((
        ("file_links"."deal_id" is not null and "file_links"."counterparty_id" is null and "file_links"."agreement_version_id" is null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is not null and "file_links"."agreement_version_id" is null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is null and "file_links"."agreement_version_id" is not null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is null and "file_links"."agreement_version_id" is null and "file_links"."payment_step_id" is not null)
      ));--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
        "file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment', 'payment_step_evidence')
        and "file_links"."attachment_purpose" is not null
        and "file_links"."attachment_visibility" is not null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ) or (
        "file_links"."link_kind" = 'agreement_signed_contract'
        and "file_links"."attachment_purpose" is null
        and "file_links"."attachment_visibility" is null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ));--> statement-breakpoint
DROP TYPE "public"."deal_leg_operation_kind";--> statement-breakpoint
DROP TYPE "public"."deal_leg_state";--> statement-breakpoint
DROP TYPE "public"."deal_operational_position_kind";--> statement-breakpoint
DROP TYPE "public"."deal_operational_position_state";