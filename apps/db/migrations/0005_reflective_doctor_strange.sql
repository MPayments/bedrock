CREATE TYPE "public"."deal_leg_operation_kind" AS ENUM('payin', 'payout', 'fx_conversion', 'intracompany_transfer', 'intercompany_funding');--> statement-breakpoint
ALTER TYPE "public"."deal_timeline_event_type" ADD VALUE 'execution_requested' BEFORE 'quote_created';--> statement-breakpoint
CREATE TABLE "deal_leg_operation_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_leg_id" uuid NOT NULL,
	"treasury_operation_id" uuid NOT NULL,
	"operation_kind" "deal_leg_operation_kind" NOT NULL,
	"source_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid,
	"customer_id" uuid,
	"internal_entity_organization_id" uuid,
	"kind" text NOT NULL,
	"state" text DEFAULT 'planned' NOT NULL,
	"source_ref" text NOT NULL,
	"quote_id" uuid,
	"amount_minor" bigint,
	"currency_id" uuid,
	"counter_amount_minor" bigint,
	"counter_currency_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_leg_operation_links" ADD CONSTRAINT "deal_leg_operation_links_deal_leg_id_deal_legs_id_fk" FOREIGN KEY ("deal_leg_id") REFERENCES "public"."deal_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_operations" ADD CONSTRAINT "treasury_operations_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_operations" ADD CONSTRAINT "treasury_operations_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_operations" ADD CONSTRAINT "treasury_operations_counter_currency_id_currencies_id_fk" FOREIGN KEY ("counter_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_leg_operation_links_source_ref_uq" ON "deal_leg_operation_links" USING btree ("source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_leg_operation_links_leg_operation_uq" ON "deal_leg_operation_links" USING btree ("deal_leg_id","treasury_operation_id");--> statement-breakpoint
CREATE INDEX "deal_leg_operation_links_leg_idx" ON "deal_leg_operation_links" USING btree ("deal_leg_id");--> statement-breakpoint
CREATE INDEX "deal_leg_operation_links_operation_idx" ON "deal_leg_operation_links" USING btree ("treasury_operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_operations_source_ref_uq" ON "treasury_operations" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "treasury_operations_deal_idx" ON "treasury_operations" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "treasury_operations_customer_idx" ON "treasury_operations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "treasury_operations_internal_entity_idx" ON "treasury_operations" USING btree ("internal_entity_organization_id");--> statement-breakpoint
CREATE INDEX "treasury_operations_kind_idx" ON "treasury_operations" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "treasury_operations_quote_idx" ON "treasury_operations" USING btree ("quote_id");