CREATE TABLE "fx_quote_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"from_amount_minor" bigint NOT NULL,
	"to_amount_minor" bigint NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"source_kind" text DEFAULT 'derived' NOT NULL,
	"source_ref" text,
	"as_of" timestamp with time zone NOT NULL,
	"execution_org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_order_id" uuid NOT NULL,
	"quote_id" uuid,
	"component_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"kind" text NOT NULL,
	"bucket" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"metadata" jsonb,
	"memo" text,
	"reserve_entry_id" uuid,
	"initiate_entry_id" uuid,
	"resolve_entry_id" uuid,
	"pending_transfer_id" numeric(39,0),
	"payout_org_id" uuid,
	"payout_bank_stable_key" text,
	"rail_ref" text,
	"status" text DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "pricing_mode" text DEFAULT 'auto_cross' NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "pricing_trace" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "deal_direction" text;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "deal_form" text;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_execution_org_id_organizations_id_fk" FOREIGN KEY ("execution_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_parent_order_id_payment_orders_id_fk" FOREIGN KEY ("parent_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_reserve_entry_id_journal_entries_id_fk" FOREIGN KEY ("reserve_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_initiate_entry_id_journal_entries_id_fk" FOREIGN KEY ("initiate_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_resolve_entry_id_journal_entries_id_fk" FOREIGN KEY ("resolve_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_payout_org_id_organizations_id_fk" FOREIGN KEY ("payout_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_legs_quote_idx_uq" ON "fx_quote_legs" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_legs_quote_idx" ON "fx_quote_legs" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payment_orders_idem_uq" ON "fee_payment_orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fee_payment_orders_status_idx" ON "fee_payment_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fee_payment_orders_parent_idx" ON "fee_payment_orders" USING btree ("parent_order_id");--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "fee_from_minor";--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "spread_from_minor";