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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_rules_calc_method_chk" CHECK (("fee_rules"."calc_method" = 'bps') OR ("fee_rules"."calc_method" = 'fixed')),
		CONSTRAINT "fee_rules_calc_value_chk" CHECK ((("fee_rules"."calc_method" = 'bps') AND ("fee_rules"."bps" IS NOT NULL) AND ("fee_rules"."fixed_amount_minor" IS NULL)) OR (("fee_rules"."calc_method" = 'fixed') AND ("fee_rules"."fixed_amount_minor" IS NOT NULL) AND ("fee_rules"."bps" IS NULL))),
	CONSTRAINT "fee_rules_accounts_pair_chk" CHECK (("fee_rules"."debit_account_key" IS NULL AND "fee_rules"."credit_account_key" IS NULL) OR ("fee_rules"."debit_account_key" IS NOT NULL AND "fee_rules"."credit_account_key" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "fx_quote_fee_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"rule_id" uuid,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"source" text DEFAULT 'policy' NOT NULL,
	"settlement_mode" text DEFAULT 'in_ledger' NOT NULL,
	"debit_account_key" text,
	"credit_account_key" text,
	"transfer_code" integer,
	"memo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_quote_fee_components_accounts_pair_chk" CHECK (("fx_quote_fee_components"."debit_account_key" IS NULL AND "fx_quote_fee_components"."credit_account_key" IS NULL) OR ("fx_quote_fee_components"."debit_account_key" IS NOT NULL AND "fx_quote_fee_components"."credit_account_key" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_rule_id_fee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fee_rules_op_active_priority_idx" ON "fee_rules" USING btree ("operation_kind","is_active","priority");--> statement-breakpoint
CREATE INDEX "fee_rules_effective_idx" ON "fee_rules" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_fee_components_quote_idx_uq" ON "fx_quote_fee_components" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_fee_components_quote_id_idx" ON "fx_quote_fee_components" USING btree ("quote_id");
