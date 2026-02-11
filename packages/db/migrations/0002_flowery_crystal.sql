CREATE TABLE "internal_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"from_account_key" text NOT NULL,
	"to_account_key" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"memo" text,
	"maker_user_id" uuid NOT NULL,
	"checker_user_id" uuid,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"reject_reason" text,
	"ledger_entry_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"scope_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"issue_code" text NOT NULL,
	"severity" text DEFAULT 'high' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP CONSTRAINT "fx_quotes_order_id_payment_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "policy_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "from_currency" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "to_currency" text NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "from_amount_minor" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "to_amount_minor" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "fee_from_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "spread_from_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "used_by_ref" text;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD COLUMN "idempotency_key" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "internal_transfers_org_idem_uq" ON "internal_transfers" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "internal_transfers_org_status_idx" ON "internal_transfers" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "internal_transfers_org_created_idx" ON "internal_transfers" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recon_exc_identity_uq" ON "reconciliation_exceptions" USING btree ("source","scope_key","entity_type","entity_id","issue_code");--> statement-breakpoint
CREATE INDEX "recon_exc_status_due_idx" ON "reconciliation_exceptions" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "recon_exc_scope_status_idx" ON "reconciliation_exceptions" USING btree ("scope_key","status");--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_policy_id_fx_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."fx_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quotes_idem_uq" ON "fx_quotes" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fx_quotes_status_idx" ON "fx_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fx_quotes_expires_idx" ON "fx_quotes" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "order_id";--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "base_currency";--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "quote_currency";--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "base_amount_minor";--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "quote_amount_minor";--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "fee_base_minor";--> statement-breakpoint
ALTER TABLE "fx_quotes" DROP COLUMN "spread_base_minor";