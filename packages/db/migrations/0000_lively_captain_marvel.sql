CREATE TABLE "fx_quote_fee_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"rule_id" uuid,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"source" text DEFAULT 'rule' NOT NULL,
	"settlement_mode" text DEFAULT 'in_ledger' NOT NULL,
	"debit_account_key" text,
	"credit_account_key" text,
	"transfer_code" integer,
	"memo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"operation_kind" text NOT NULL,
	"fee_kind" text NOT NULL,
	"calc_method" text DEFAULT 'bps' NOT NULL,
	"bps" integer,
	"fixed_amount_minor" bigint,
	"fixed_currency" text,
	"settlement_mode" text DEFAULT 'in_ledger' NOT NULL,
	"deal_direction" text,
	"deal_form" text,
	"from_currency" text,
	"to_currency" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"debit_account_key" text,
	"credit_account_key" text,
	"transfer_code" integer,
	"memo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "fx_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"from_amount_minor" bigint NOT NULL,
	"to_amount_minor" bigint NOT NULL,
	"pricing_mode" text DEFAULT 'auto_cross' NOT NULL,
	"pricing_trace" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deal_direction" text,
	"deal_form" text,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"used_by_ref" text,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"plan_fingerprint" text NOT NULL,
	"posting_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"posted_at" timestamp with time zone,
	"outbox_attempts" integer DEFAULT 0 NOT NULL,
	"last_outbox_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"account_key" text NOT NULL,
	"side" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"currency" text NOT NULL,
	"tb_ledger" bigint NOT NULL,
	"tb_account_id" numeric(39,0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"locked_at" timestamp with time zone,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tb_transfer_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"plan_key" text NOT NULL,
	"type" text DEFAULT 'create' NOT NULL,
	"chain_id" text,
	"transfer_id" numeric(39,0) NOT NULL,
	"debit_key" text,
	"credit_key" text,
	"currency" text NOT NULL,
	"tb_ledger" bigint NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"code" integer DEFAULT 1 NOT NULL,
	"is_linked" boolean DEFAULT false NOT NULL,
	"is_pending" boolean DEFAULT false NOT NULL,
	"timeout_seconds" integer DEFAULT 0 NOT NULL,
	"pending_id" numeric(39,0),
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tb_plan_amount_nonneg" CHECK ("tb_transfer_plans"."amount" >= 0),
	CONSTRAINT "tb_plan_create_keys" CHECK (("tb_transfer_plans"."type" <> 'create') OR ("tb_transfer_plans"."debit_key" IS NOT NULL AND "tb_transfer_plans"."credit_key" IS NOT NULL)),
	CONSTRAINT "tb_plan_pending_id" CHECK (("tb_transfer_plans"."type" = 'create') OR ("tb_transfer_plans"."pending_id" IS NOT NULL)),
	CONSTRAINT "tb_plan_void_amount" CHECK (("tb_transfer_plans"."type" <> 'void_pending') OR ("tb_transfer_plans"."amount" = 0)),
	CONSTRAINT "tb_plan_timeout" CHECK (("tb_transfer_plans"."is_pending" = false) OR ("tb_transfer_plans"."timeout_seconds" > 0))
);
--> statement-breakpoint
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
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rail" text DEFAULT 'bank' NOT NULL,
	"currency" text NOT NULL,
	"label" text NOT NULL,
	"account_no" text,
	"iban" text,
	"bic_swift" text,
	"bank_name" text,
	"stable_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"external_ref" text,
	"display_name" text NOT NULL,
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
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_org_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'quote' NOT NULL,
	"ledger_entry_id" uuid,
	"payin_currency" text NOT NULL,
	"payin_expected_minor" bigint NOT NULL,
	"payout_currency" text NOT NULL,
	"payout_amount_minor" bigint NOT NULL,
	"payin_org_id" uuid NOT NULL,
	"payin_account_id" uuid,
	"payout_org_id" uuid NOT NULL,
	"payout_account_id" uuid,
	"beneficiary_name" text,
	"beneficiary_country" text,
	"beneficiary_invoice_ref" text,
	"idempotency_key" text NOT NULL,
	"payout_pending_transfer_id" numeric(39,0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"rail_ref" text,
	"occurred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"is_treasury" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_rule_id_fee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_execution_org_id_organizations_id_fk" FOREIGN KEY ("execution_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_transfer_plans" ADD CONSTRAINT "tb_transfer_plans_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_parent_order_id_payment_orders_id_fk" FOREIGN KEY ("parent_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_reserve_entry_id_journal_entries_id_fk" FOREIGN KEY ("reserve_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_initiate_entry_id_journal_entries_id_fk" FOREIGN KEY ("initiate_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_resolve_entry_id_journal_entries_id_fk" FOREIGN KEY ("resolve_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_payout_org_id_organizations_id_fk" FOREIGN KEY ("payout_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_customer_org_id_organizations_id_fk" FOREIGN KEY ("customer_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_ledger_entry_id_journal_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payin_org_id_organizations_id_fk" FOREIGN KEY ("payin_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payin_account_id_bank_accounts_id_fk" FOREIGN KEY ("payin_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payout_org_id_organizations_id_fk" FOREIGN KEY ("payout_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payout_account_id_bank_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_fee_components_quote_idx_uq" ON "fx_quote_fee_components" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_fee_components_quote_id_idx" ON "fx_quote_fee_components" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "fee_rules_op_active_priority_idx" ON "fee_rules" USING btree ("operation_kind","is_active","priority");--> statement-breakpoint
CREATE INDEX "fee_rules_effective_idx" ON "fee_rules" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_legs_quote_idx_uq" ON "fx_quote_legs" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_legs_quote_idx" ON "fx_quote_legs" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quotes_idem_uq" ON "fx_quotes" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fx_quotes_status_idx" ON "fx_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fx_quotes_expires_idx" ON "fx_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "fx_rates_pair_asof_idx" ON "fx_rates" USING btree ("base_currency","quote_currency","as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_asof_idx" ON "fx_rates" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "journal_entries_org_status_idx" ON "journal_entries" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_org_idem_uq" ON "journal_entries" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_lines_entry_lineno_uq" ON "journal_lines" USING btree ("entry_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_org_key_uq" ON "ledger_accounts" USING btree ("org_id","tb_ledger","key");--> statement-breakpoint
CREATE INDEX "ledger_accounts_org_cur_idx" ON "ledger_accounts" USING btree ("org_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_kind_ref_uq" ON "outbox" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "outbox_claim_idx" ON "outbox" USING btree ("kind","status","available_at","created_at") WHERE "outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_processing_lease_idx" ON "outbox" USING btree ("kind","status","locked_at") WHERE "outbox"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "outbox_status_avail_idx" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "tb_plan_post_idx" ON "tb_transfer_plans" USING btree ("org_id","journal_entry_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_entry_idx_uq" ON "tb_transfer_plans" USING btree ("journal_entry_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_org_transfer_uq" ON "tb_transfer_plans" USING btree ("org_id","transfer_id");--> statement-breakpoint
CREATE INDEX "tb_plan_status_idx" ON "tb_transfer_plans" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_transfers_org_idem_uq" ON "internal_transfers" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "internal_transfers_org_status_idx" ON "internal_transfers" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "internal_transfers_org_created_idx" ON "internal_transfers" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_org_stable_uq" ON "bank_accounts" USING btree ("org_id","stable_key");--> statement-breakpoint
CREATE INDEX "bank_accounts_org_cur_idx" ON "bank_accounts" USING btree ("org_id","currency");--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payment_orders_idem_uq" ON "fee_payment_orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fee_payment_orders_status_idx" ON "fee_payment_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fee_payment_orders_parent_idx" ON "fee_payment_orders" USING btree ("parent_order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "payment_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idem_uq" ON "payment_orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "recon_exc_identity_uq" ON "reconciliation_exceptions" USING btree ("source","scope_key","entity_type","entity_id","issue_code");--> statement-breakpoint
CREATE INDEX "recon_exc_status_due_idx" ON "reconciliation_exceptions" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "recon_exc_scope_status_idx" ON "reconciliation_exceptions" USING btree ("scope_key","status");