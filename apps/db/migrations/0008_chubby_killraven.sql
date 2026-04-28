ALTER TYPE "public"."calculation_line_kind" ADD VALUE 'commercial_revenue';--> statement-breakpoint
ALTER TYPE "public"."calculation_line_kind" ADD VALUE 'commercial_discount';--> statement-breakpoint
ALTER TYPE "public"."calculation_line_kind" ADD VALUE 'pass_through_reimbursement';--> statement-breakpoint
ALTER TYPE "public"."calculation_line_kind" ADD VALUE 'execution_expense';--> statement-breakpoint
CREATE TABLE "treasury_inventory_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"quote_id" uuid,
	"amount_minor" bigint NOT NULL,
	"cost_amount_minor" bigint NOT NULL,
	"ledger_hold_ref" text NOT NULL,
	"owner_book_id" uuid NOT NULL,
	"owner_requisite_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_inventory_positions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_order_id" uuid NOT NULL,
	"source_quote_execution_id" uuid NOT NULL,
	"owner_party_id" uuid NOT NULL,
	"owner_requisite_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"owner_book_id" uuid NOT NULL,
	"ledger_subject_type" text DEFAULT 'organization_requisite' NOT NULL,
	"acquired_amount_minor" bigint NOT NULL,
	"available_amount_minor" bigint NOT NULL,
	"cost_currency_id" uuid NOT NULL,
	"cost_amount_minor" bigint NOT NULL,
	"source_posting_document_id" uuid NOT NULL,
	"source_posting_document_kind" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "treasury_inventory_allocations" ADD CONSTRAINT "treasury_inventory_allocations_position_id_treasury_inventory_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."treasury_inventory_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_inventory_allocations" ADD CONSTRAINT "treasury_inventory_allocations_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_inventory_positions" ADD CONSTRAINT "treasury_inventory_positions_source_order_id_treasury_orders_id_fk" FOREIGN KEY ("source_order_id") REFERENCES "public"."treasury_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_inventory_positions" ADD CONSTRAINT "treasury_inventory_positions_source_quote_execution_id_quote_executions_id_fk" FOREIGN KEY ("source_quote_execution_id") REFERENCES "public"."quote_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_inventory_positions" ADD CONSTRAINT "treasury_inventory_positions_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_inventory_positions" ADD CONSTRAINT "treasury_inventory_positions_cost_currency_id_currencies_id_fk" FOREIGN KEY ("cost_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_inventory_allocations_position_deal_quote_uq" ON "treasury_inventory_allocations" USING btree ("position_id","deal_id","quote_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_allocations_position_idx" ON "treasury_inventory_allocations" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_allocations_deal_idx" ON "treasury_inventory_allocations" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_allocations_hold_ref_idx" ON "treasury_inventory_allocations" USING btree ("ledger_hold_ref");--> statement-breakpoint
CREATE INDEX "treasury_inventory_allocations_quote_idx" ON "treasury_inventory_allocations" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_allocations_state_idx" ON "treasury_inventory_allocations" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_inventory_positions_quote_execution_uq" ON "treasury_inventory_positions" USING btree ("source_quote_execution_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_positions_order_idx" ON "treasury_inventory_positions" USING btree ("source_order_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_positions_currency_idx" ON "treasury_inventory_positions" USING btree ("currency_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_positions_owner_idx" ON "treasury_inventory_positions" USING btree ("owner_party_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_positions_owner_book_idx" ON "treasury_inventory_positions" USING btree ("owner_book_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_positions_source_document_idx" ON "treasury_inventory_positions" USING btree ("source_posting_document_id");--> statement-breakpoint
CREATE INDEX "treasury_inventory_positions_state_idx" ON "treasury_inventory_positions" USING btree ("state");