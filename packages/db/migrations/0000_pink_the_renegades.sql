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
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_transfer_plans" ADD CONSTRAINT "tb_transfer_plans_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "tb_plan_status_idx" ON "tb_transfer_plans" USING btree ("org_id","status");