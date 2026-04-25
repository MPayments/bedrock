CREATE TYPE "public"."deal_leg_manual_override" AS ENUM('blocked', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'leg_manual_override_set' BEFORE 'execution_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'leg_manual_override_cleared' BEFORE 'execution_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_outcome_recorded' BEFORE 'return_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'instruction_artifact_attached' BEFORE 'return_requested';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'deal_leg_amended' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'deal_route_template_swapped' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'acceptance_revoked_by_operator' BEFORE 'quote_created';--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'reconciliation_exception_resolved';--> statement-breakpoint
ALTER TYPE "public"."file_link_kind" ADD VALUE 'payment_step_evidence';--> statement-breakpoint
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
CREATE TABLE "payment_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"deal_id" uuid,
	"deal_leg_idx" integer,
	"deal_leg_role" text,
	"treasury_batch_id" uuid,
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
	"postings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_reason" text,
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
ALTER TABLE "reconciliation_matches" DROP CONSTRAINT "reconciliation_matches_matched_treasury_operation_id_treasury_operations_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "manual_override_state" "deal_leg_manual_override";--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "override_reason_code" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "override_comment" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "route_snapshot_leg_id" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "from_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "to_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_quote_acceptances" ADD COLUMN "revocation_reason" text;--> statement-breakpoint
ALTER TABLE "file_links" ADD COLUMN "payment_step_id" uuid;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "pricing_fingerprint" text;--> statement-breakpoint
ALTER TABLE "payment_route_templates" ADD COLUMN "min_margin_bps" integer;--> statement-breakpoint
ALTER TABLE "payment_route_templates" ADD COLUMN "max_margin_bps" integer;--> statement-breakpoint
ALTER TABLE "deal_pricing_contexts" ADD CONSTRAINT "deal_pricing_contexts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_step_artifacts" ADD CONSTRAINT "payment_step_artifacts_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_step_attempts" ADD CONSTRAINT "payment_step_attempts_payment_step_id_payment_steps_id_fk" FOREIGN KEY ("payment_step_id") REFERENCES "public"."payment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD CONSTRAINT "payment_steps_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_steps" ADD CONSTRAINT "payment_steps_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_pricing_contexts_revision_idx" ON "deal_pricing_contexts" USING btree ("revision");--> statement-breakpoint
CREATE INDEX "payment_step_artifacts_step_idx" ON "payment_step_artifacts" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_artifacts_step_purpose_idx" ON "payment_step_artifacts" USING btree ("payment_step_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_step_attempts_step_attempt_uq" ON "payment_step_attempts" USING btree ("payment_step_id","attempt_no");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_step_idx" ON "payment_step_attempts" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_outcome_idx" ON "payment_step_attempts" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "payment_step_attempts_provider_ref_idx" ON "payment_step_attempts" USING btree ("provider_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_steps_deal_leg_uq" ON "payment_steps" USING btree ("deal_id","deal_leg_idx");--> statement-breakpoint
CREATE INDEX "payment_steps_purpose_idx" ON "payment_steps" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "payment_steps_kind_idx" ON "payment_steps" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "payment_steps_state_idx" ON "payment_steps" USING btree ("state");--> statement-breakpoint
CREATE INDEX "payment_steps_deal_idx" ON "payment_steps" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "payment_steps_batch_idx" ON "payment_steps" USING btree ("treasury_batch_id");--> statement-breakpoint
CREATE INDEX "payment_steps_scheduled_idx" ON "payment_steps" USING btree ("scheduled_at");--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_treasury_operation_id_payment_steps_id_fk" FOREIGN KEY ("matched_treasury_operation_id") REFERENCES "public"."payment_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_legs_deal_route_leg_idx" ON "deal_legs" USING btree ("deal_id","route_snapshot_leg_id");--> statement-breakpoint
CREATE INDEX "file_links_payment_step_idx" ON "file_links" USING btree ("payment_step_id");--> statement-breakpoint
CREATE INDEX "fx_quotes_deal_fingerprint_idx" ON "fx_quotes" USING btree ("deal_id","pricing_fingerprint");--> statement-breakpoint
ALTER TABLE "deal_legs" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_exactly_one_owner_chk" CHECK ((
        ("file_links"."deal_id" is not null and "file_links"."counterparty_id" is null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is not null and "file_links"."payment_step_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is null and "file_links"."payment_step_id" is not null)
      ));--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
        "file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment', 'payment_step_evidence')
        and "file_links"."attachment_purpose" is not null
        and "file_links"."attachment_visibility" is not null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ) or (
        "file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract')
        and "file_links"."attachment_purpose" is null
        and "file_links"."attachment_visibility" is null
        and "file_links"."generated_format" is not null
        and "file_links"."generated_lang" is not null
      ));--> statement-breakpoint
DROP TYPE "public"."deal_leg_operation_kind";--> statement-breakpoint
DROP TYPE "public"."deal_leg_state";--> statement-breakpoint
DROP TYPE "public"."deal_operational_position_kind";--> statement-breakpoint
DROP TYPE "public"."deal_operational_position_state";