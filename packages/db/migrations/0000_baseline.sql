CREATE TYPE "public"."chart_account_kind" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'active_passive');--> statement-breakpoint
CREATE TYPE "public"."chart_normal_side" AS ENUM('debit', 'credit', 'both');--> statement-breakpoint
CREATE TYPE "public"."dimension_mode" AS ENUM('required', 'optional', 'forbidden');--> statement-breakpoint
CREATE TYPE "public"."dimension_policy_scope" AS ENUM('line', 'debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."counterparty_country_code" AS ENUM('AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW');--> statement-breakpoint
CREATE TYPE "public"."counterparty_kind" AS ENUM('legal_entity', 'individual');--> statement-breakpoint
CREATE TYPE "public"."account_provider_type" AS ENUM('bank', 'exchange', 'blockchain', 'custodian');--> statement-breakpoint
CREATE TABLE "accounting_pack_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text DEFAULT 'book' NOT NULL,
	"scope_id" text NOT NULL,
	"pack_checksum" text NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_pack_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_key" text NOT NULL,
	"version" integer NOT NULL,
	"checksum" text NOT NULL,
	"compiled_json" jsonb NOT NULL,
	"compiled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"book_id" uuid NOT NULL,
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
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"currency" text NOT NULL,
	"event_type" text NOT NULL,
	"hold_ref" text,
	"operation_id" uuid,
	"delta_ledger_balance" bigint DEFAULT 0 NOT NULL,
	"delta_available" bigint DEFAULT 0 NOT NULL,
	"delta_reserved" bigint DEFAULT 0 NOT NULL,
	"delta_pending" bigint DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"actor_id" text,
	"request_id" text,
	"correlation_id" text,
	"trace_id" text,
	"causation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"currency" text NOT NULL,
	"hold_ref" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"reason" text,
	"actor_id" text,
	"request_id" text,
	"correlation_id" text,
	"trace_id" text,
	"causation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "balance_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"currency" text NOT NULL,
	"ledger_balance" bigint DEFAULT 0 NOT NULL,
	"available" bigint DEFAULT 0 NOT NULL,
	"reserved" bigint DEFAULT 0 NOT NULL,
	"pending" bigint DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_projector_cursors" (
	"worker_key" text PRIMARY KEY NOT NULL,
	"last_posted_at" timestamp with time zone,
	"last_operation_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_projector_cursor_pair_chk" CHECK (("balance_projector_cursors"."last_posted_at" IS NULL AND "balance_projector_cursors"."last_operation_id" IS NULL) OR ("balance_projector_cursors"."last_posted_at" IS NOT NULL AND "balance_projector_cursors"."last_operation_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "platform_component_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"previous_state" text,
	"new_state" text NOT NULL,
	"reason" text NOT NULL,
	"retry_after_sec" integer DEFAULT 300 NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "platform_component_runtime_meta" (
	"id" integer PRIMARY KEY NOT NULL,
	"state_epoch" bigint DEFAULT 1 NOT NULL,
	"manifest_checksum" text NOT NULL,
	"manifest_seen_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_component_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"state" text NOT NULL,
	"reason" text NOT NULL,
	"retry_after_sec" integer DEFAULT 300 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_cursors" (
	"provider_code" text NOT NULL,
	"cursor_key" text NOT NULL,
	"cursor_value" text,
	"claim_token" text,
	"claim_until" timestamp with time zone,
	"last_fetched_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_cursors_pk" PRIMARY KEY("provider_code","cursor_key")
);
--> statement-breakpoint
CREATE TABLE "connector_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"event_type" text NOT NULL,
	"webhook_idempotency_key" text NOT NULL,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"parse_status" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"parsed_payload" jsonb,
	"intent_id" uuid,
	"attempt_id" uuid,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "connector_health" (
	"provider_code" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"score" integer DEFAULT 100 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"direction" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"corridor" text,
	"provider_constraint" text,
	"status" text NOT NULL,
	"current_attempt_no" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"intent_id" uuid,
	"attempt_id" uuid,
	"ref_kind" text NOT NULL,
	"ref_value" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"provider_code" text NOT NULL,
	"provider_route" text,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"external_attempt_ref" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error" text,
	"next_retry_at" timestamp with time zone,
	"claim_token" text,
	"claim_until" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
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
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_ref" text,
	"display_name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_type" text NOT NULL,
	"doc_no" text NOT NULL,
	"module_id" text DEFAULT 'legacy' NOT NULL,
	"module_version" integer DEFAULT 1 NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"title" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"submission_status" text NOT NULL,
	"approval_status" text NOT NULL,
	"posting_status" text NOT NULL,
	"lifecycle_status" text NOT NULL,
	"create_idempotency_key" text,
	"amount_minor" bigint,
	"currency" text,
	"memo" text,
	"counterparty_id" uuid,
	"customer_id" uuid,
	"operational_account_id" uuid,
	"search_text" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"rejected_by" text,
	"rejected_at" timestamp with time zone,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"posting_started_at" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"posting_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"request_id" text,
	"correlation_id" text,
	"trace_id" text,
	"causation_id" text,
	"reason_code" text,
	"reason_meta" jsonb,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_document_id" uuid NOT NULL,
	"to_document_id" uuid NOT NULL,
	"link_type" text NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_links_no_self" CHECK ("document_links"."from_document_id" <> "document_links"."to_document_id")
);
--> statement-breakpoint
CREATE TABLE "document_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_version" integer NOT NULL,
	"module_id" text NOT NULL,
	"module_version" integer NOT NULL,
	"pack_checksum" text NOT NULL,
	"posting_plan_checksum" text NOT NULL,
	"journal_intent_checksum" text NOT NULL,
	"posting_plan" jsonb NOT NULL,
	"journal_intent" jsonb NOT NULL,
	"resolved_templates" jsonb,
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
CREATE TABLE "action_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"actor_id" text,
	"request_hash" text NOT NULL,
	"status" text NOT NULL,
	"result_json" jsonb,
	"error_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_account_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"account_no" text NOT NULL,
	"currency" text NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dimensions_hash" text NOT NULL,
	"tb_ledger" bigint NOT NULL,
	"tb_account_id" numeric(39,0) NOT NULL,
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
CREATE TABLE "postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"book_id" uuid NOT NULL,
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
CREATE TABLE "orchestration_scope_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text DEFAULT 'book' NOT NULL,
	"scope_id" text NOT NULL,
	"routing_rule_id" uuid NOT NULL,
	"override_config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_corridors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"corridor" text NOT NULL,
	"direction" text NOT NULL,
	"currency" text NOT NULL,
	"country_from" text,
	"country_to" text,
	"supports_webhooks" boolean DEFAULT true NOT NULL,
	"polling_required" boolean DEFAULT false NOT NULL,
	"sla_score" integer DEFAULT 50 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_fee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"corridor" text NOT NULL,
	"currency" text NOT NULL,
	"fixed_fee_minor" bigint DEFAULT 0 NOT NULL,
	"bps" integer DEFAULT 0 NOT NULL,
	"fx_markup_bps" integer DEFAULT 0 NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_code" text NOT NULL,
	"corridor" text NOT NULL,
	"currency" text NOT NULL,
	"min_amount_minor" bigint NOT NULL,
	"max_amount_minor" bigint NOT NULL,
	"daily_volume_minor" bigint,
	"daily_count" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"priority" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"direction" text,
	"corridor" text,
	"currency" text,
	"country_from" text,
	"country_to" text,
	"amount_min_minor" bigint,
	"amount_max_minor" bigint,
	"risk_min" integer,
	"risk_max" integer,
	"preferred_providers" jsonb,
	"degradation_order" jsonb,
	"weight_cost" integer DEFAULT 40 NOT NULL,
	"weight_fx" integer DEFAULT 20 NOT NULL,
	"weight_sla" integer DEFAULT 20 NOT NULL,
	"weight_health" integer DEFAULT 20 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"external_record_id" uuid NOT NULL,
	"adjustment_document_id" uuid,
	"reason_code" text NOT NULL,
	"reason_meta" jsonb,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reconciliation_external_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_record_id" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"normalized_payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"normalization_version" integer NOT NULL,
	"request_id" text,
	"correlation_id" text,
	"trace_id" text,
	"causation_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"external_record_id" uuid NOT NULL,
	"matched_operation_id" uuid,
	"matched_document_id" uuid,
	"status" text NOT NULL,
	"explanation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"ruleset_checksum" text NOT NULL,
	"input_query" jsonb NOT NULL,
	"result_summary" jsonb NOT NULL,
	"request_id" text,
	"correlation_id" text,
	"trace_id" text,
	"causation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting_pack_assignments" ADD CONSTRAINT "accounting_pack_assignments_pack_checksum_accounting_pack_versions_checksum_fk" FOREIGN KEY ("pack_checksum") REFERENCES "public"."accounting_pack_versions"("checksum") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_account_dimension_policy" ADD CONSTRAINT "chart_account_dimension_policy_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_debit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("debit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_credit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("credit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_account_bindings" ADD CONSTRAINT "operational_account_bindings_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_account_bindings" ADD CONSTRAINT "operational_account_bindings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_account_bindings" ADD CONSTRAINT "operational_account_bindings_book_account_instance_id_book_account_instances_id_fk" FOREIGN KEY ("book_account_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_events" ADD CONSTRAINT "balance_events_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_events" ADD CONSTRAINT "balance_events_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_holds" ADD CONSTRAINT "balance_holds_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_positions" ADD CONSTRAINT "balance_positions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_events" ADD CONSTRAINT "connector_events_intent_id_connector_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."connector_payment_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_events" ADD CONSTRAINT "connector_events_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_payment_intents" ADD CONSTRAINT "connector_payment_intents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_references" ADD CONSTRAINT "connector_references_intent_id_connector_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."connector_payment_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_references" ADD CONSTRAINT "connector_references_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_intent_id_connector_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."connector_payment_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_group_memberships" ADD CONSTRAINT "counterparty_group_memberships_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_group_memberships" ADD CONSTRAINT "counterparty_group_memberships_group_id_counterparty_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."counterparty_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_groups" ADD CONSTRAINT "counterparty_groups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_groups" ADD CONSTRAINT "counterparty_groups_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."counterparty_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_operational_account_id_operational_accounts_id_fk" FOREIGN KEY ("operational_account_id") REFERENCES "public"."operational_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_from_document_id_documents_id_fk" FOREIGN KEY ("from_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_to_document_id_documents_id_fk" FOREIGN KEY ("to_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_fixed_currency_id_currencies_id_fk" FOREIGN KEY ("fixed_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rules" ADD CONSTRAINT "fee_rules_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_rule_id_fee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_execution_counterparty_id_counterparties_id_fk" FOREIGN KEY ("execution_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quotes" ADD CONSTRAINT "fx_quotes_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_base_currency_id_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_quote_currency_id_currencies_id_fk" FOREIGN KEY ("quote_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_account_instances" ADD CONSTRAINT "book_account_instances_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_debit_instance_id_book_account_instances_id_fk" FOREIGN KEY ("debit_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_credit_instance_id_book_account_instances_id_fk" FOREIGN KEY ("credit_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_transfer_plans" ADD CONSTRAINT "tb_transfer_plans_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_accounts" ADD CONSTRAINT "operational_accounts_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_accounts" ADD CONSTRAINT "operational_accounts_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_accounts" ADD CONSTRAINT "operational_accounts_account_provider_id_operational_account_providers_id_fk" FOREIGN KEY ("account_provider_id") REFERENCES "public"."operational_account_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestration_scope_overrides" ADD CONSTRAINT "orchestration_scope_overrides_routing_rule_id_routing_rules_id_fk" FOREIGN KEY ("routing_rule_id") REFERENCES "public"."routing_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_external_record_id_reconciliation_external_records_id_fk" FOREIGN KEY ("external_record_id") REFERENCES "public"."reconciliation_external_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_adjustment_document_id_documents_id_fk" FOREIGN KEY ("adjustment_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_external_record_id_reconciliation_external_records_id_fk" FOREIGN KEY ("external_record_id") REFERENCES "public"."reconciliation_external_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_operation_id_ledger_operations_id_fk" FOREIGN KEY ("matched_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_document_id_documents_id_fk" FOREIGN KEY ("matched_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounting_pack_assignments_scope_effective_idx" ON "accounting_pack_assignments" USING btree ("scope_type","scope_id","effective_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_pack_versions_pack_version_uq" ON "accounting_pack_versions" USING btree ("pack_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_pack_versions_checksum_uq" ON "accounting_pack_versions" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "accounting_pack_versions_pack_compiled_idx" ON "accounting_pack_versions" USING btree ("pack_key","compiled_at");--> statement-breakpoint
CREATE INDEX "chart_template_parent_idx" ON "chart_template_accounts" USING btree ("parent_account_no");--> statement-breakpoint
CREATE UNIQUE INDEX "correspondence_rule_uq" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no");--> statement-breakpoint
CREATE INDEX "correspondence_rule_lookup_idx" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no","enabled");--> statement-breakpoint
CREATE INDEX "operational_account_binding_book_idx" ON "operational_account_bindings" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "operational_account_binding_instance_idx" ON "operational_account_bindings" USING btree ("book_account_instance_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "balance_events_subject_created_idx" ON "balance_events" USING btree ("book_id","subject_type","subject_id","currency","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_events_operation_subject_uq" ON "balance_events" USING btree ("operation_id","subject_type","subject_id","currency","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_holds_subject_ref_uq" ON "balance_holds" USING btree ("book_id","subject_type","subject_id","currency","hold_ref");--> statement-breakpoint
CREATE INDEX "balance_holds_state_created_idx" ON "balance_holds" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_positions_subject_uq" ON "balance_positions" USING btree ("book_id","subject_type","subject_id","currency");--> statement-breakpoint
CREATE INDEX "platform_component_events_component_changed_idx" ON "platform_component_events" USING btree ("component_id","changed_at");--> statement-breakpoint
CREATE INDEX "platform_component_events_scope_changed_idx" ON "platform_component_events" USING btree ("scope_type","scope_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_component_states_scope_uq" ON "platform_component_states" USING btree ("component_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "platform_component_states_component_idx" ON "platform_component_states" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "platform_component_states_scope_idx" ON "platform_component_states" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "connector_cursors_claim_idx" ON "connector_cursors" USING btree ("claim_until","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_events_provider_key_uq" ON "connector_events" USING btree ("provider_code","webhook_idempotency_key");--> statement-breakpoint
CREATE INDEX "connector_events_provider_received_idx" ON "connector_events" USING btree ("provider_code","received_at");--> statement-breakpoint
CREATE INDEX "connector_events_intent_received_idx" ON "connector_events" USING btree ("intent_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_payment_intents_document_uq" ON "connector_payment_intents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "connector_payment_intents_status_idx" ON "connector_payment_intents" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connector_references_provider_kind_value_uq" ON "connector_references" USING btree ("provider_code","ref_kind","ref_value");--> statement-breakpoint
CREATE INDEX "connector_references_intent_idx" ON "connector_references" USING btree ("intent_id","created_at");--> statement-breakpoint
CREATE INDEX "connector_references_attempt_idx" ON "connector_references" USING btree ("attempt_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_intent_no_uq" ON "payment_attempts" USING btree ("intent_id","attempt_no");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_idempotency_uq" ON "payment_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_attempts_dispatch_claim_idx" ON "payment_attempts" USING btree ("status","next_retry_at","created_at") WHERE "payment_attempts"."status" in ('queued','failed_retryable');--> statement-breakpoint
CREATE INDEX "payment_attempts_poll_claim_idx" ON "payment_attempts" USING btree ("status","updated_at") WHERE "payment_attempts"."status" in ('submitted','pending');--> statement-breakpoint
CREATE INDEX "payment_attempts_poll_claim_lease_idx" ON "payment_attempts" USING btree ("status","claim_until","updated_at") WHERE "payment_attempts"."status" in ('submitted','pending');--> statement-breakpoint
CREATE INDEX "payment_attempts_provider_status_idx" ON "payment_attempts" USING btree ("provider_code","status");--> statement-breakpoint
CREATE INDEX "counterparty_group_memberships_group_idx" ON "counterparty_group_memberships" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counterparty_groups_code_uq" ON "counterparty_groups" USING btree ("code");--> statement-breakpoint
CREATE INDEX "counterparty_groups_parent_idx" ON "counterparty_groups" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_code_uq" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_doc_no_uq" ON "documents" USING btree ("doc_no");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_doc_type_create_idem_uq" ON "documents" USING btree ("doc_type","create_idempotency_key") WHERE "documents"."create_idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "documents_doc_type_occurred_idx" ON "documents" USING btree ("doc_type","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_posting_status_occurred_idx" ON "documents" USING btree ("posting_status","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_approval_status_occurred_idx" ON "documents" USING btree ("approval_status","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_submission_status_occurred_idx" ON "documents" USING btree ("submission_status","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_lifecycle_status_occurred_idx" ON "documents" USING btree ("lifecycle_status","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "documents_currency_idx" ON "documents" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "documents_counterparty_idx" ON "documents" USING btree ("counterparty_id");--> statement-breakpoint
CREATE INDEX "documents_customer_idx" ON "documents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "documents_operational_account_idx" ON "documents" USING btree ("operational_account_id");--> statement-breakpoint
CREATE INDEX "documents_payload_gin_idx" ON "documents" USING gin ("payload");--> statement-breakpoint
CREATE INDEX "document_events_document_created_idx" ON "document_events" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_links_from_type_idx" ON "document_links" USING btree ("from_document_id","link_type");--> statement-breakpoint
CREATE INDEX "document_links_to_type_idx" ON "document_links" USING btree ("to_document_id","link_type");--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_unique_idx" ON "document_links" USING btree ("from_document_id","to_document_id","link_type","role");--> statement-breakpoint
CREATE UNIQUE INDEX "document_operations_document_kind_uq" ON "document_operations" USING btree ("document_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "document_operations_operation_uq" ON "document_operations" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "document_operations_document_idx" ON "document_operations" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_snapshots_document_uq" ON "document_snapshots" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_snapshots_created_idx" ON "document_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "fee_rules_op_active_priority_idx" ON "fee_rules" USING btree ("operation_kind","is_active","priority");--> statement-breakpoint
CREATE INDEX "fee_rules_effective_idx" ON "fee_rules" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_fee_components_quote_idx_uq" ON "fx_quote_fee_components" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_fee_components_quote_id_idx" ON "fx_quote_fee_components" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_legs_quote_idx_uq" ON "fx_quote_legs" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_legs_quote_idx" ON "fx_quote_legs" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quotes_idem_uq" ON "fx_quotes" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fx_quotes_status_idx" ON "fx_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fx_quotes_expires_idx" ON "fx_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_source_pair_asof_uq" ON "fx_rates" USING btree ("source","base_currency_id","quote_currency_id","as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_pair_asof_idx" ON "fx_rates" USING btree ("base_currency_id","quote_currency_id","as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_asof_idx" ON "fx_rates" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_source_asof_idx" ON "fx_rates" USING btree ("source","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "action_receipts_scope_key_uq" ON "action_receipts" USING btree ("scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "action_receipts_scope_created_idx" ON "action_receipts" USING btree ("scope","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "books_code_uq" ON "books" USING btree ("code");--> statement-breakpoint
CREATE INDEX "books_counterparty_idx" ON "books" USING btree ("counterparty_id");--> statement-breakpoint
CREATE INDEX "books_counterparty_default_idx" ON "books" USING btree ("counterparty_id","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "book_account_instances_uq" ON "book_account_instances" USING btree ("book_id","account_no","currency","dimensions_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "book_account_instances_tb_uq" ON "book_account_instances" USING btree ("book_id","tb_ledger","tb_account_id");--> statement-breakpoint
CREATE INDEX "book_account_instances_book_currency_idx" ON "book_account_instances" USING btree ("book_id","currency");--> statement-breakpoint
CREATE INDEX "book_account_instances_account_no_idx" ON "book_account_instances" USING btree ("account_no");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_operations_idem_uq" ON "ledger_operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_operations_status_idx" ON "ledger_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_operations_source_idx" ON "ledger_operations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_kind_ref_uq" ON "outbox" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "outbox_claim_idx" ON "outbox" USING btree ("kind","status","available_at","created_at") WHERE "outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_processing_lease_idx" ON "outbox" USING btree ("kind","status","locked_at") WHERE "outbox"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "outbox_status_avail_idx" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "postings_op_line_uq" ON "postings" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "postings_op_idx" ON "postings" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "postings_book_currency_idx" ON "postings" USING btree ("book_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_operation_line_uq" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_transfer_uq" ON "tb_transfer_plans" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "tb_plan_post_idx" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "tb_plan_status_idx" ON "tb_transfer_plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_account_providers_name_uq" ON "operational_account_providers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_accounts_counterparty_stable_uq" ON "operational_accounts" USING btree ("counterparty_id","stable_key");--> statement-breakpoint
CREATE INDEX "operational_accounts_counterparty_cur_idx" ON "operational_accounts" USING btree ("counterparty_id","currency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orchestration_scope_overrides_scope_rule_uq" ON "orchestration_scope_overrides" USING btree ("scope_type","scope_id","routing_rule_id");--> statement-breakpoint
CREATE INDEX "orchestration_scope_overrides_scope_idx" ON "orchestration_scope_overrides" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_corridors_provider_corridor_direction_currency_uq" ON "provider_corridors" USING btree ("provider_code","corridor","direction","currency");--> statement-breakpoint
CREATE INDEX "provider_corridors_enabled_idx" ON "provider_corridors" USING btree ("enabled","provider_code","corridor","direction","currency");--> statement-breakpoint
CREATE INDEX "provider_fee_schedules_lookup_idx" ON "provider_fee_schedules" USING btree ("provider_code","corridor","currency","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_limits_provider_corridor_currency_uq" ON "provider_limits" USING btree ("provider_code","corridor","currency");--> statement-breakpoint
CREATE INDEX "provider_limits_enabled_idx" ON "provider_limits" USING btree ("enabled","provider_code","corridor");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_rules_name_uq" ON "routing_rules" USING btree ("name");--> statement-breakpoint
CREATE INDEX "routing_rules_enabled_priority_idx" ON "routing_rules" USING btree ("enabled","priority");--> statement-breakpoint
CREATE INDEX "routing_rules_match_idx" ON "routing_rules" USING btree ("enabled","direction","corridor","currency");--> statement-breakpoint
CREATE INDEX "recon_exceptions_run_idx" ON "reconciliation_exceptions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "recon_exceptions_state_created_idx" ON "reconciliation_exceptions" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recon_external_records_source_id_uq" ON "reconciliation_external_records" USING btree ("source","source_record_id");--> statement-breakpoint
CREATE INDEX "recon_external_records_source_received_idx" ON "reconciliation_external_records" USING btree ("source","received_at");--> statement-breakpoint
CREATE INDEX "recon_matches_run_idx" ON "reconciliation_matches" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "recon_matches_external_record_idx" ON "reconciliation_matches" USING btree ("external_record_id");--> statement-breakpoint
CREATE INDEX "recon_runs_source_created_idx" ON "reconciliation_runs" USING btree ("source","created_at");