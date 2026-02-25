ALTER TABLE IF EXISTS "internal_transfers" RENAME TO "internal_transfers_legacy";--> statement-breakpoint

CREATE TYPE "public"."transfer_kind" AS ENUM('intra_org', 'cross_org');--> statement-breakpoint
CREATE TYPE "public"."transfer_settlement_mode" AS ENUM('immediate', 'pending');--> statement-breakpoint
CREATE TYPE "public"."transfer_status_v2" AS ENUM('draft', 'approved_pending_posting', 'pending', 'settle_pending_posting', 'void_pending_posting', 'posted', 'voided', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transfer_event_type" AS ENUM('approve', 'settle', 'void');--> statement-breakpoint

CREATE TABLE "account_ledger_bindings" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"ledger_org_id" uuid NOT NULL,
	"ledger_key" text NOT NULL,
	"currency_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "transfer_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_counterparty_id" uuid NOT NULL,
	"destination_counterparty_id" uuid NOT NULL,
	"source_account_id" uuid NOT NULL,
	"destination_account_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"kind" "transfer_kind" NOT NULL,
	"settlement_mode" "transfer_settlement_mode" DEFAULT 'immediate' NOT NULL,
	"timeout_seconds" integer DEFAULT 0 NOT NULL,
	"status" "transfer_status_v2" DEFAULT 'draft' NOT NULL,
	"memo" text,
	"maker_user_id" uuid NOT NULL,
	"checker_user_id" uuid,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"reject_reason" text,
	"ledger_entry_id" uuid,
	"pending_transfer_id" numeric(39, 0),
	"idempotency_key" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "transfer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"event_type" "transfer_event_type" NOT NULL,
	"event_idempotency_key" text NOT NULL,
	"external_ref" text,
	"ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "account_ledger_bindings" ADD CONSTRAINT "account_ledger_bindings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_ledger_bindings" ADD CONSTRAINT "account_ledger_bindings_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_transfer_id_transfer_orders_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "account_ledger_bindings_org_key_uq" ON "account_ledger_bindings" USING btree ("ledger_org_id","ledger_key");--> statement-breakpoint
CREATE INDEX "account_ledger_bindings_currency_idx" ON "account_ledger_bindings" USING btree ("currency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_orders_source_counterparty_idem_uq" ON "transfer_orders" USING btree ("source_counterparty_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfer_orders_source_counterparty_created_idx" ON "transfer_orders" USING btree ("source_counterparty_id","created_at");--> statement-breakpoint
CREATE INDEX "transfer_orders_destination_counterparty_created_idx" ON "transfer_orders" USING btree ("destination_counterparty_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_events_transfer_type_idem_uq" ON "transfer_events" USING btree ("transfer_id","event_type","event_idempotency_key");--> statement-breakpoint
CREATE INDEX "transfer_events_transfer_created_idx" ON "transfer_events" USING btree ("transfer_id","created_at");
