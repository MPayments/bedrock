CREATE TYPE "public"."deal_capability_kind" AS ENUM('can_collect', 'can_fx', 'can_payout', 'can_transit', 'can_exporter_settle');--> statement-breakpoint
CREATE TYPE "public"."deal_capability_status" AS ENUM('enabled', 'disabled', 'pending');--> statement-breakpoint
CREATE TYPE "public"."deal_operational_position_kind" AS ENUM('customer_receivable', 'provider_payable', 'intercompany_due_from', 'intercompany_due_to', 'in_transit', 'suspense', 'exporter_expected_receivable', 'fee_revenue', 'spread_revenue');--> statement-breakpoint
CREATE TYPE "public"."deal_operational_position_state" AS ENUM('not_applicable', 'pending', 'ready', 'in_progress', 'done', 'blocked');--> statement-breakpoint
CREATE TABLE "deal_capability_states" (
	"id" uuid PRIMARY KEY NOT NULL,
	"applicant_counterparty_id" uuid NOT NULL,
	"internal_entity_organization_id" uuid NOT NULL,
	"deal_type" "deal_type" NOT NULL,
	"capability_kind" "deal_capability_kind" NOT NULL,
	"status" "deal_capability_status" NOT NULL,
	"reason_code" text,
	"note" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_operational_positions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"kind" "deal_operational_position_kind" NOT NULL,
	"state" "deal_operational_position_state" NOT NULL,
	"amount_minor" bigint,
	"currency_id" uuid,
	"reason_code" text,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_capability_states" ADD CONSTRAINT "deal_capability_states_applicant_counterparty_id_counterparties_id_fk" FOREIGN KEY ("applicant_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_capability_states" ADD CONSTRAINT "deal_capability_states_internal_entity_organization_id_organizations_id_fk" FOREIGN KEY ("internal_entity_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_capability_states" ADD CONSTRAINT "deal_capability_states_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_operational_positions" ADD CONSTRAINT "deal_operational_positions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_operational_positions" ADD CONSTRAINT "deal_operational_positions_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_capability_states_scope_uq" ON "deal_capability_states" USING btree ("applicant_counterparty_id","internal_entity_organization_id","deal_type","capability_kind");--> statement-breakpoint
CREATE INDEX "deal_capability_states_applicant_idx" ON "deal_capability_states" USING btree ("applicant_counterparty_id");--> statement-breakpoint
CREATE INDEX "deal_capability_states_internal_entity_idx" ON "deal_capability_states" USING btree ("internal_entity_organization_id");--> statement-breakpoint
CREATE INDEX "deal_capability_states_status_idx" ON "deal_capability_states" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_operational_positions_deal_kind_uq" ON "deal_operational_positions" USING btree ("deal_id","kind");--> statement-breakpoint
CREATE INDEX "deal_operational_positions_deal_idx" ON "deal_operational_positions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_operational_positions_state_idx" ON "deal_operational_positions" USING btree ("state");