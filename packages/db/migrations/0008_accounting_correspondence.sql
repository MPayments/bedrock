DROP TABLE IF EXISTS "transfer_events" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "transfer_orders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "account_ledger_bindings" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tb_transfer_plans" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "journal_lines" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "journal_entries" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ledger_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "outbox" CASCADE;--> statement-breakpoint

DO $$ BEGIN
    CREATE TYPE "public"."chart_account_kind" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'active_passive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."chart_normal_side" AS ENUM('debit', 'credit', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."chart_analytic_type" AS ENUM('counterparty_id', 'customer_id', 'order_id', 'operational_account_id', 'transfer_id', 'quote_id', 'fee_bucket');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."correspondence_scope" AS ENUM('global', 'org');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE "book_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "account_no" text NOT NULL,
    "currency" text NOT NULL,
    "tb_ledger" bigint NOT NULL,
    "tb_account_id" numeric(39, 0) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "chart_template_accounts" (
    "account_no" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "kind" "chart_account_kind" NOT NULL,
    "normal_side" "chart_normal_side" NOT NULL,
    "posting_allowed" boolean DEFAULT true NOT NULL,
    "parent_account_no" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "chart_template_account_no_fmt" CHECK ("chart_template_accounts"."account_no" ~ '^[0-9]{2}(\\.[0-9]{2})?$')
);--> statement-breakpoint

CREATE TABLE "chart_template_account_analytics" (
    "account_no" text NOT NULL,
    "analytic_type" "chart_analytic_type" NOT NULL,
    "required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("account_no", "analytic_type")
);--> statement-breakpoint

CREATE TABLE "chart_org_overrides" (
    "org_id" uuid NOT NULL,
    "account_no" text NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "name_override" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("org_id", "account_no")
);--> statement-breakpoint

CREATE TABLE "correspondence_rules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "scope" "correspondence_scope" NOT NULL,
    "org_id" uuid,
    "posting_code" text NOT NULL,
    "debit_account_no" text NOT NULL,
    "credit_account_no" text NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "correspondence_scope_org_ck" CHECK (("correspondence_rules"."scope" = 'global' AND "correspondence_rules"."org_id" IS NULL) OR ("correspondence_rules"."scope" = 'org' AND "correspondence_rules"."org_id" IS NOT NULL))
);--> statement-breakpoint

CREATE TABLE "ledger_operations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "source_type" text NOT NULL,
    "source_id" text NOT NULL,
    "operation_code" text NOT NULL,
    "operation_version" integer DEFAULT 1 NOT NULL,
    "idempotency_key" text NOT NULL,
    "payload_hash" text NOT NULL,
    "posting_date" timestamp with time zone NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "error" text,
    "posted_at" timestamp with time zone,
    "outbox_attempts" integer DEFAULT 0 NOT NULL,
    "last_outbox_error_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "ledger_postings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "operation_id" uuid NOT NULL,
    "line_no" integer NOT NULL,
    "book_org_id" uuid NOT NULL,
    "debit_book_account_id" uuid NOT NULL,
    "credit_book_account_id" uuid NOT NULL,
    "posting_code" text NOT NULL,
    "currency" text NOT NULL,
    "amount_minor" bigint NOT NULL,
    "memo" text,
    "analytic_counterparty_id" uuid,
    "analytic_customer_id" uuid,
    "analytic_order_id" uuid,
    "analytic_operational_account_id" uuid,
    "analytic_transfer_id" uuid,
    "analytic_quote_id" uuid,
    "analytic_fee_bucket" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "operational_account_bindings" (
    "account_id" uuid PRIMARY KEY NOT NULL,
    "book_account_id" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "outbox" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid,
    "kind" text NOT NULL,
    "ref_id" uuid NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "error" text,
    "locked_at" timestamp with time zone,
    "available_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "tb_transfer_plans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "operation_id" uuid NOT NULL,
    "line_no" integer NOT NULL,
    "type" text DEFAULT 'create' NOT NULL,
    "transfer_id" numeric(39, 0) NOT NULL,
    "debit_tb_account_id" numeric(39, 0),
    "credit_tb_account_id" numeric(39, 0),
    "tb_ledger" bigint DEFAULT 0 NOT NULL,
    "amount" bigint DEFAULT 0 NOT NULL,
    "code" integer DEFAULT 1 NOT NULL,
    "pending_ref" text,
    "pending_id" numeric(39, 0),
    "is_linked" boolean DEFAULT false NOT NULL,
    "is_pending" boolean DEFAULT false NOT NULL,
    "timeout_seconds" integer DEFAULT 0 NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "tb_plan_amount_nonneg" CHECK ("tb_transfer_plans"."amount" >= 0),
    CONSTRAINT "tb_plan_create_accounts" CHECK (("tb_transfer_plans"."type" <> 'create') OR ("tb_transfer_plans"."debit_tb_account_id" IS NOT NULL AND "tb_transfer_plans"."credit_tb_account_id" IS NOT NULL)),
    CONSTRAINT "tb_plan_pending_id" CHECK (("tb_transfer_plans"."type" = 'create') OR ("tb_transfer_plans"."pending_id" IS NOT NULL)),
    CONSTRAINT "tb_plan_void_amount" CHECK (("tb_transfer_plans"."type" <> 'void_pending') OR ("tb_transfer_plans"."amount" = 0)),
    CONSTRAINT "tb_plan_timeout" CHECK (("tb_transfer_plans"."is_pending" = false) OR ("tb_transfer_plans"."timeout_seconds" > 0))
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
    "ledger_operation_id" uuid,
    "source_pending_transfer_id" numeric(39, 0),
    "destination_pending_transfer_id" numeric(39, 0),
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
    "ledger_operation_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "chart_template_account_analytics" ADD CONSTRAINT "chart_template_account_analytics_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_org_overrides" ADD CONSTRAINT "chart_org_overrides_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_debit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("debit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_credit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("credit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_debit_book_account_id_book_accounts_id_fk" FOREIGN KEY ("debit_book_account_id") REFERENCES "public"."book_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_credit_book_account_id_book_accounts_id_fk" FOREIGN KEY ("credit_book_account_id") REFERENCES "public"."book_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_account_bindings" ADD CONSTRAINT "operational_account_bindings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_account_bindings" ADD CONSTRAINT "operational_account_bindings_book_account_id_book_accounts_id_fk" FOREIGN KEY ("book_account_id") REFERENCES "public"."book_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_transfer_plans" ADD CONSTRAINT "tb_transfer_plans_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_ledger_operation_id_ledger_operations_id_fk" FOREIGN KEY ("ledger_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_transfer_id_transfer_orders_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_ledger_operation_id_ledger_operations_id_fk" FOREIGN KEY ("ledger_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_orders" DROP COLUMN IF EXISTS "ledger_entry_id";--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "ledger_operation_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_ledger_operation_id_ledger_operations_id_fk" FOREIGN KEY ("ledger_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "fee_payment_orders" DROP COLUMN IF EXISTS "reserve_entry_id";--> statement-breakpoint
ALTER TABLE "fee_payment_orders" DROP COLUMN IF EXISTS "initiate_entry_id";--> statement-breakpoint
ALTER TABLE "fee_payment_orders" DROP COLUMN IF EXISTS "resolve_entry_id";--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD COLUMN "reserve_operation_id" uuid;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD COLUMN "initiate_operation_id" uuid;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD COLUMN "resolve_operation_id" uuid;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_reserve_operation_id_ledger_operations_id_fk" FOREIGN KEY ("reserve_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_initiate_operation_id_ledger_operations_id_fk" FOREIGN KEY ("initiate_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_resolve_operation_id_ledger_operations_id_fk" FOREIGN KEY ("resolve_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "book_accounts_org_no_currency_uq" ON "book_accounts" USING btree ("org_id","account_no","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "book_accounts_org_tb_uq" ON "book_accounts" USING btree ("org_id","tb_ledger","tb_account_id");--> statement-breakpoint
CREATE INDEX "book_accounts_org_currency_idx" ON "book_accounts" USING btree ("org_id","currency");--> statement-breakpoint
CREATE INDEX "chart_template_parent_idx" ON "chart_template_accounts" USING btree ("parent_account_no");--> statement-breakpoint
CREATE INDEX "chart_org_override_org_idx" ON "chart_org_overrides" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "correspondence_rule_uq" ON "correspondence_rules" USING btree ("scope","org_id","posting_code","debit_account_no","credit_account_no");--> statement-breakpoint
CREATE INDEX "correspondence_rule_lookup_idx" ON "correspondence_rules" USING btree ("scope","org_id","posting_code","debit_account_no","credit_account_no","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_operations_idem_uq" ON "ledger_operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_operations_status_idx" ON "ledger_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_operations_source_idx" ON "ledger_operations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_postings_op_line_uq" ON "ledger_postings" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "ledger_postings_op_idx" ON "ledger_postings" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "ledger_postings_org_currency_idx" ON "ledger_postings" USING btree ("book_org_id","currency");--> statement-breakpoint
CREATE INDEX "operational_account_binding_book_idx" ON "operational_account_bindings" USING btree ("book_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_kind_ref_uq" ON "outbox" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "outbox_claim_idx" ON "outbox" USING btree ("kind","status","available_at","created_at") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_processing_lease_idx" ON "outbox" USING btree ("kind","status","locked_at") WHERE "status" = 'processing';--> statement-breakpoint
CREATE INDEX "outbox_status_avail_idx" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_operation_line_uq" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_transfer_uq" ON "tb_transfer_plans" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "tb_plan_post_idx" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "tb_plan_status_idx" ON "tb_transfer_plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_orders_source_counterparty_idem_uq" ON "transfer_orders" USING btree ("source_counterparty_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfer_orders_source_counterparty_created_idx" ON "transfer_orders" USING btree ("source_counterparty_id","created_at");--> statement-breakpoint
CREATE INDEX "transfer_orders_destination_counterparty_created_idx" ON "transfer_orders" USING btree ("destination_counterparty_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_events_transfer_type_idem_uq" ON "transfer_events" USING btree ("transfer_id","event_type","event_idempotency_key");--> statement-breakpoint
CREATE INDEX "transfer_events_transfer_created_idx" ON "transfer_events" USING btree ("transfer_id","created_at");
