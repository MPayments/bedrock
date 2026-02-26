CREATE TYPE "public"."chart_account_kind" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'active_passive');--> statement-breakpoint
CREATE TYPE "public"."chart_normal_side" AS ENUM('debit', 'credit', 'both');--> statement-breakpoint
CREATE TYPE "public"."dimension_mode" AS ENUM('required', 'optional', 'forbidden');--> statement-breakpoint
CREATE TYPE "public"."dimension_policy_scope" AS ENUM('line', 'debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."transfer_event_type" AS ENUM('approve', 'settle', 'void');--> statement-breakpoint
CREATE TYPE "public"."transfer_kind" AS ENUM('intra_org', 'cross_org');--> statement-breakpoint
CREATE TYPE "public"."transfer_settlement_mode" AS ENUM('immediate', 'pending');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('draft', 'approved_pending_posting', 'pending', 'settle_pending_posting', 'void_pending_posting', 'posted', 'voided', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."account_provider_type" AS ENUM('bank', 'exchange', 'blockchain', 'custodian');--> statement-breakpoint
CREATE TYPE "public"."counterparty_country_code" AS ENUM('AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW');--> statement-breakpoint
CREATE TYPE "public"."counterparty_kind" AS ENUM('legal_entity', 'individual');--> statement-breakpoint
CREATE TYPE "public"."fee_accounting_treatment" AS ENUM('income', 'pass_through', 'expense');--> statement-breakpoint
CREATE TABLE "chart_account_dimension_policy" (
	"account_no" text NOT NULL,
	"dimension_key" text NOT NULL,
	"mode" "dimension_mode" DEFAULT 'required' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chart_account_dimension_policy_account_no_dimension_key_pk" PRIMARY KEY("account_no","dimension_key")
);
--> statement-breakpoint
CREATE TABLE "chart_template_accounts" (
	"account_no" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" chart_account_kind NOT NULL,
	"normal_side" chart_normal_side NOT NULL,
	"posting_allowed" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"parent_account_no" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chart_template_account_no_fmt" CHECK ("chart_template_accounts"."account_no" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "correspondence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"posting_code" text NOT NULL,
	"debit_account_no" text NOT NULL,
	"credit_account_no" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_account_bindings" (
	"operational_account_id" uuid PRIMARY KEY NOT NULL,
	"book_account_instance_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posting_code_dimension_policy" (
	"posting_code" text NOT NULL,
	"dimension_key" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"scope" "dimension_policy_scope" DEFAULT 'line' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posting_code_dimension_policy_posting_code_dimension_key_pk" PRIMARY KEY("posting_code","dimension_key")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"symbol" text NOT NULL,
	"precision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "currencies_precision_non_negative" CHECK ("currencies"."precision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_ref" text,
	"display_name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_quote_fee_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"rule_id" uuid,
	"kind" text NOT NULL,
	"currency_id" uuid NOT NULL,
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
	"fixed_currency_id" uuid,
	"settlement_mode" text DEFAULT 'in_ledger' NOT NULL,
	"accounting_treatment" text DEFAULT 'income' NOT NULL,
	"deal_direction" text,
	"deal_form" text,
	"from_currency_id" uuid,
	"to_currency_id" uuid,
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
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"from_amount_minor" bigint NOT NULL,
	"to_amount_minor" bigint NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"source_kind" text DEFAULT 'derived' NOT NULL,
	"source_ref" text,
	"as_of" timestamp with time zone NOT NULL,
	"execution_counterparty_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
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
CREATE TABLE "fx_rate_sources" (
	"source" text PRIMARY KEY NOT NULL,
	"ttl_seconds" integer NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_published_at" timestamp with time zone,
	"last_status" text DEFAULT 'idle' NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"base_currency_id" uuid NOT NULL,
	"quote_currency_id" uuid NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"book_org_id" uuid NOT NULL,
	"debit_instance_id" uuid NOT NULL,
	"credit_instance_id" uuid NOT NULL,
	"posting_code" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"memo" text,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_account_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_org_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"currency" text NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dimensions_hash" text NOT NULL,
	"tb_ledger" bigint NOT NULL,
	"tb_account_id" numeric(39,0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "tb_transfer_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"type" text DEFAULT 'create' NOT NULL,
	"transfer_id" numeric(39,0) NOT NULL,
	"debit_tb_account_id" numeric(39,0),
	"credit_tb_account_id" numeric(39,0),
	"tb_ledger" bigint DEFAULT 0 NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"code" integer DEFAULT 1 NOT NULL,
	"pending_ref" text,
	"pending_id" numeric(39,0),
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
);
--> statement-breakpoint
CREATE TABLE "transfer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"event_type" "transfer_event_type" NOT NULL,
	"event_idempotency_key" text NOT NULL,
	"external_ref" text,
	"ledger_operation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_counterparty_id" uuid NOT NULL,
	"destination_counterparty_id" uuid NOT NULL,
	"source_operational_account_id" uuid NOT NULL,
	"destination_operational_account_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"kind" "transfer_kind" NOT NULL,
	"settlement_mode" "transfer_settlement_mode" DEFAULT 'immediate' NOT NULL,
	"timeout_seconds" integer DEFAULT 0 NOT NULL,
	"status" "transfer_status" DEFAULT 'draft' NOT NULL,
	"memo" text,
	"maker_user_id" uuid NOT NULL,
	"checker_user_id" uuid,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"reject_reason" text,
	"ledger_operation_id" uuid,
	"source_pending_transfer_id" numeric(39,0),
	"destination_pending_transfer_id" numeric(39,0),
	"idempotency_key" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_account_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "account_provider_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"address" text,
	"contact" text,
	"bic" text,
	"swift" text,
	"country" "counterparty_country_code" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"account_provider_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"account_no" text,
	"corr_account" text,
	"address" text,
	"iban" text,
	"stable_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counterparties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"customer_id" uuid,
	"short_name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text,
	"country" "counterparty_country_code",
	"kind" "counterparty_kind" DEFAULT 'legal_entity' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counterparty_group_memberships" (
	"counterparty_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counterparty_group_memberships_pk" PRIMARY KEY("counterparty_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "counterparty_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"customer_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"metadata" jsonb,
	"memo" text,
	"reserve_operation_id" uuid,
	"initiate_operation_id" uuid,
	"resolve_operation_id" uuid,
	"pending_transfer_id" numeric(39,0),
	"payout_counterparty_id" uuid,
	"payout_operational_account_id" uuid NOT NULL,
	"accounting_treatment" "fee_accounting_treatment" DEFAULT 'pass_through' NOT NULL,
	"rail_ref" text,
	"status" text DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_counterparty_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'quote' NOT NULL,
	"ledger_operation_id" uuid,
	"payin_currency_id" uuid NOT NULL,
	"payin_expected_minor" bigint NOT NULL,
	"payout_currency_id" uuid NOT NULL,
	"payout_amount_minor" bigint NOT NULL,
	"payin_counterparty_id" uuid NOT NULL,
	"payin_account_id" uuid,
	"payout_counterparty_id" uuid NOT NULL,
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
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"rail_ref" text,
	"occurred_at" timestamp with time zone,
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
ALTER TABLE "chart_account_dimension_policy" ADD CONSTRAINT "chart_account_dimension_policy_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_debit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("debit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_credit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("credit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_account_bindings" ADD CONSTRAINT "operational_account_bindings_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_account_bindings" ADD CONSTRAINT "operational_account_bindings_book_account_instance_id_book_account_instances_id_fk" FOREIGN KEY ("book_account_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_rule_id_fee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_fixed_currency_id_currencies_id_fk" FOREIGN KEY ("fixed_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_execution_counterparty_id_counterparties_id_fk" FOREIGN KEY ("execution_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_base_currency_id_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_quote_currency_id_currencies_id_fk" FOREIGN KEY ("quote_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_debit_instance_id_book_account_instances_id_fk" FOREIGN KEY ("debit_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_credit_instance_id_book_account_instances_id_fk" FOREIGN KEY ("credit_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_transfer_plans" ADD CONSTRAINT "tb_transfer_plans_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_transfer_id_transfer_orders_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_events" ADD CONSTRAINT "transfer_events_ledger_operation_id_ledger_operations_id_fk" FOREIGN KEY ("ledger_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_source_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("source_operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_destination_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("destination_operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_orders" ADD CONSTRAINT "transfer_orders_ledger_operation_id_ledger_operations_id_fk" FOREIGN KEY ("ledger_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_accounts" ADD CONSTRAINT "operational_accounts_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_accounts" ADD CONSTRAINT "operational_accounts_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_accounts" ADD CONSTRAINT "operational_accounts_account_provider_id_operational_account_providers_id_fk" FOREIGN KEY ("account_provider_id") REFERENCES "public"."operational_account_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_group_memberships" ADD CONSTRAINT "counterparty_group_memberships_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_group_memberships" ADD CONSTRAINT "counterparty_group_memberships_group_id_counterparty_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."counterparty_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_groups" ADD CONSTRAINT "counterparty_groups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_groups" ADD CONSTRAINT "counterparty_groups_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."counterparty_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_parent_order_id_payment_orders_id_fk" FOREIGN KEY ("parent_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_reserve_operation_id_ledger_operations_id_fk" FOREIGN KEY ("reserve_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_initiate_operation_id_ledger_operations_id_fk" FOREIGN KEY ("initiate_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_resolve_operation_id_ledger_operations_id_fk" FOREIGN KEY ("resolve_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_payout_counterparty_id_counterparties_id_fk" FOREIGN KEY ("payout_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payment_orders" ADD CONSTRAINT "fee_payment_orders_payout_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("payout_operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_customer_counterparty_id_counterparties_id_fk" FOREIGN KEY ("customer_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_ledger_operation_id_ledger_operations_id_fk" FOREIGN KEY ("ledger_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payin_currency_id_currencies_id_fk" FOREIGN KEY ("payin_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payout_currency_id_currencies_id_fk" FOREIGN KEY ("payout_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payin_counterparty_id_counterparties_id_fk" FOREIGN KEY ("payin_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payin_account_id_operational_accounts_id_fk" FOREIGN KEY ("payin_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payout_counterparty_id_counterparties_id_fk" FOREIGN KEY ("payout_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payout_account_id_operational_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chart_template_parent_idx" ON "chart_template_accounts" USING btree ("parent_account_no");--> statement-breakpoint
CREATE UNIQUE INDEX "correspondence_rule_uq" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no");--> statement-breakpoint
CREATE INDEX "correspondence_rule_lookup_idx" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no","enabled");--> statement-breakpoint
CREATE INDEX "operational_account_binding_instance_idx" ON "operational_account_bindings" USING btree ("book_account_instance_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_code_uq" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_fee_components_quote_idx_uq" ON "fx_quote_fee_components" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_fee_components_quote_id_idx" ON "fx_quote_fee_components" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "fee_rules_op_active_priority_idx" ON "fee_rules" USING btree ("operation_kind","is_active","priority");--> statement-breakpoint
CREATE INDEX "fee_rules_effective_idx" ON "fee_rules" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_legs_quote_idx_uq" ON "fx_quote_legs" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_legs_quote_idx" ON "fx_quote_legs" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quotes_idem_uq" ON "fx_quotes" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fx_quotes_status_idx" ON "fx_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fx_quotes_expires_idx" ON "fx_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_source_pair_asof_uq" ON "fx_rates" USING btree ("source","base_currency_id","quote_currency_id","as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_pair_asof_idx" ON "fx_rates" USING btree ("base_currency_id","quote_currency_id","as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_asof_idx" ON "fx_rates" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_source_asof_idx" ON "fx_rates" USING btree ("source","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_operations_idem_uq" ON "ledger_operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_operations_status_idx" ON "ledger_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_operations_source_idx" ON "ledger_operations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "postings_op_line_uq" ON "postings" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "postings_op_idx" ON "postings" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "postings_org_currency_idx" ON "postings" USING btree ("book_org_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "book_account_instances_uq" ON "book_account_instances" USING btree ("book_org_id","account_no","currency","dimensions_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "book_account_instances_tb_uq" ON "book_account_instances" USING btree ("book_org_id","tb_ledger","tb_account_id");--> statement-breakpoint
CREATE INDEX "book_account_instances_org_currency_idx" ON "book_account_instances" USING btree ("book_org_id","currency");--> statement-breakpoint
CREATE INDEX "book_account_instances_account_no_idx" ON "book_account_instances" USING btree ("account_no");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_kind_ref_uq" ON "outbox" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "outbox_claim_idx" ON "outbox" USING btree ("kind","status","available_at","created_at") WHERE "outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_processing_lease_idx" ON "outbox" USING btree ("kind","status","locked_at") WHERE "outbox"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "outbox_status_avail_idx" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_operation_line_uq" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_transfer_uq" ON "tb_transfer_plans" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "tb_plan_post_idx" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "tb_plan_status_idx" ON "tb_transfer_plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_events_transfer_type_idem_uq" ON "transfer_events" USING btree ("transfer_id","event_type","event_idempotency_key");--> statement-breakpoint
CREATE INDEX "transfer_events_transfer_created_idx" ON "transfer_events" USING btree ("transfer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_orders_source_counterparty_idem_uq" ON "transfer_orders" USING btree ("source_counterparty_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "transfer_orders_status_idx" ON "transfer_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfer_orders_source_counterparty_created_idx" ON "transfer_orders" USING btree ("source_counterparty_id","created_at");--> statement-breakpoint
CREATE INDEX "transfer_orders_destination_counterparty_created_idx" ON "transfer_orders" USING btree ("destination_counterparty_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_account_providers_name_uq" ON "operational_account_providers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_accounts_counterparty_stable_uq" ON "operational_accounts" USING btree ("counterparty_id","stable_key");--> statement-breakpoint
CREATE INDEX "operational_accounts_counterparty_cur_idx" ON "operational_accounts" USING btree ("counterparty_id","currency_id");--> statement-breakpoint
CREATE INDEX "counterparty_group_memberships_group_idx" ON "counterparty_group_memberships" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counterparty_groups_code_uq" ON "counterparty_groups" USING btree ("code");--> statement-breakpoint
CREATE INDEX "counterparty_groups_parent_idx" ON "counterparty_groups" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payment_orders_idem_uq" ON "fee_payment_orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fee_payment_orders_status_idx" ON "fee_payment_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fee_payment_orders_parent_idx" ON "fee_payment_orders" USING btree ("parent_order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "payment_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idem_uq" ON "payment_orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "recon_exc_identity_uq" ON "reconciliation_exceptions" USING btree ("source","scope_key","entity_type","entity_id","issue_code");--> statement-breakpoint
CREATE INDEX "recon_exc_status_due_idx" ON "reconciliation_exceptions" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "recon_exc_scope_status_idx" ON "reconciliation_exceptions" USING btree ("scope_key","status");