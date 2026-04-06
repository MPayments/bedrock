CREATE TYPE "public"."agreement_fee_rule_kind" AS ENUM('agent_fee', 'fixed_fee');--> statement-breakpoint
CREATE TYPE "public"."agreement_fee_rule_unit" AS ENUM('bps', 'money');--> statement-breakpoint
CREATE TYPE "public"."agreement_party_role" AS ENUM('customer', 'organization');--> statement-breakpoint
CREATE TYPE "public"."calculation_line_kind" AS ENUM('original_amount', 'fee_amount', 'total_amount', 'additional_expenses', 'fee_amount_in_base', 'total_in_base', 'additional_expenses_in_base', 'total_with_expenses_in_base', 'fee_revenue', 'spread_revenue', 'provider_fee_expense', 'pass_through', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."calculation_rate_source" AS ENUM('cbr', 'investing', 'xe', 'manual', 'fx_quote');--> statement-breakpoint
CREATE TYPE "public"."chart_account_kind" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense', 'active_passive');--> statement-breakpoint
CREATE TYPE "public"."chart_normal_side" AS ENUM('debit', 'credit', 'both');--> statement-breakpoint
CREATE TYPE "public"."counterparty_country_code" AS ENUM('AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW');--> statement-breakpoint
CREATE TYPE "public"."counterparty_kind" AS ENUM('legal_entity', 'individual');--> statement-breakpoint
CREATE TYPE "public"."counterparty_relationship_kind" AS ENUM('customer_owned', 'external');--> statement-breakpoint
CREATE TYPE "public"."deal_approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deal_approval_type" AS ENUM('commercial', 'compliance', 'operations');--> statement-breakpoint
CREATE TYPE "public"."deal_attachment_ingestion_status" AS ENUM('pending', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deal_capability_kind" AS ENUM('can_collect', 'can_fx', 'can_payout', 'can_transit', 'can_exporter_settle');--> statement-breakpoint
CREATE TYPE "public"."deal_capability_status" AS ENUM('enabled', 'disabled', 'pending');--> statement-breakpoint
CREATE TYPE "public"."deal_leg_kind" AS ENUM('collect', 'convert', 'transit_hold', 'payout', 'settle_exporter');--> statement-breakpoint
CREATE TYPE "public"."deal_leg_operation_kind" AS ENUM('payin', 'payout', 'fx_conversion', 'intracompany_transfer', 'intercompany_funding');--> statement-breakpoint
CREATE TYPE "public"."deal_leg_state" AS ENUM('pending', 'ready', 'in_progress', 'done', 'blocked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."deal_operational_position_kind" AS ENUM('customer_receivable', 'provider_payable', 'intercompany_due_from', 'intercompany_due_to', 'in_transit', 'suspense', 'exporter_expected_receivable', 'fee_revenue', 'spread_revenue');--> statement-breakpoint
CREATE TYPE "public"."deal_operational_position_state" AS ENUM('not_applicable', 'pending', 'ready', 'in_progress', 'done', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."deal_participant_role" AS ENUM('customer', 'applicant', 'internal_entity', 'external_payer', 'external_beneficiary');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('draft', 'submitted', 'rejected', 'preparing_documents', 'awaiting_funds', 'awaiting_payment', 'closing_documents', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deal_timeline_event_type" AS ENUM('deal_created', 'intake_saved', 'participant_changed', 'status_changed', 'leg_state_changed', 'execution_requested', 'leg_operation_created', 'instruction_prepared', 'instruction_submitted', 'instruction_settled', 'instruction_failed', 'instruction_retried', 'instruction_voided', 'return_requested', 'instruction_returned', 'execution_blocker_resolved', 'deal_closed', 'quote_created', 'quote_accepted', 'quote_expired', 'quote_used', 'calculation_attached', 'attachment_uploaded', 'attachment_deleted', 'attachment_ingested', 'attachment_ingestion_failed', 'document_created', 'document_status_changed');--> statement-breakpoint
CREATE TYPE "public"."deal_timeline_visibility" AS ENUM('customer_safe', 'internal');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('payment', 'currency_exchange', 'currency_transit', 'exporter_settlement');--> statement-breakpoint
CREATE TYPE "public"."dimension_mode" AS ENUM('required', 'optional', 'forbidden');--> statement-breakpoint
CREATE TYPE "public"."dimension_policy_scope" AS ENUM('line', 'debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."file_asset_origin" AS ENUM('uploaded', 'generated');--> statement-breakpoint
CREATE TYPE "public"."file_attachment_purpose" AS ENUM('invoice', 'contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_attachment_visibility" AS ENUM('customer_safe', 'internal');--> statement-breakpoint
CREATE TYPE "public"."file_generated_format" AS ENUM('docx', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."file_generated_lang" AS ENUM('ru', 'en');--> statement-breakpoint
CREATE TYPE "public"."file_link_kind" AS ENUM('deal_attachment', 'legal_entity_attachment', 'deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract');--> statement-breakpoint
CREATE TYPE "public"."party_country_code" AS ENUM('AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW');--> statement-breakpoint
CREATE TYPE "public"."party_kind" AS ENUM('legal_entity', 'individual');--> statement-breakpoint
CREATE TYPE "public"."requisite_kind" AS ENUM('bank', 'exchange', 'blockchain', 'custodian');--> statement-breakpoint
CREATE TYPE "public"."requisite_owner_type" AS ENUM('organization', 'counterparty');--> statement-breakpoint
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
CREATE TABLE "accounting_close_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"revision" integer NOT NULL,
	"state" text NOT NULL,
	"close_document_id" uuid NOT NULL,
	"reopen_document_id" uuid,
	"checksum" text NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"compiled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_pack_versions_checksum_uq" UNIQUE("checksum")
);
--> statement-breakpoint
CREATE TABLE "accounting_period_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'closed' NOT NULL,
	"locked_by_document_id" uuid,
	"close_reason" text,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"reopened_by" text,
	"reopen_reason" text,
	"reopened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_report_line_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard" text DEFAULT 'ifrs' NOT NULL,
	"report_kind" text NOT NULL,
	"line_code" text NOT NULL,
	"line_label" text NOT NULL,
	"section" text NOT NULL,
	"account_no" text NOT NULL,
	"sign_multiplier" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
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
CREATE TABLE "agent_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tg_id" bigint,
	"user_name" text,
	"tag" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_allowed" boolean DEFAULT false NOT NULL,
	"allowed_by" text,
	"allowed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_profiles_tg_id_unique" UNIQUE("tg_id")
);
--> statement-breakpoint
CREATE TABLE "agreement_fee_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"kind" "agreement_fee_rule_kind" NOT NULL,
	"unit" "agreement_fee_rule_unit" NOT NULL,
	"value_numeric" numeric(20, 8) NOT NULL,
	"currency_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_fee_rules_unit_currency_chk" CHECK ((
        "agreement_fee_rules"."unit" = 'bps'
        and "agreement_fee_rules"."currency_id" is null
      ) or (
        "agreement_fee_rules"."unit" = 'money'
        and "agreement_fee_rules"."currency_id" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "agreement_parties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"party_role" "agreement_party_role" NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_parties_exactly_one_fk_chk" CHECK ((
        "agreement_parties"."customer_id" is not null
        and "agreement_parties"."organization_id" is null
      ) or (
        "agreement_parties"."customer_id" is null
        and "agreement_parties"."organization_id" is not null
      )),
	CONSTRAINT "agreement_parties_role_fk_match_chk" CHECK ((
        "agreement_parties"."party_role" = 'customer'
        and "agreement_parties"."customer_id" is not null
        and "agreement_parties"."organization_id" is null
      ) or (
        "agreement_parties"."party_role" = 'organization'
        and "agreement_parties"."organization_id" is not null
        and "agreement_parties"."customer_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "agreement_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agreement_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"contract_number" text,
	"contract_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"organization_requisite_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"current_version_id" uuid,
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
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculation_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"calculation_snapshot_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"kind" "calculation_line_kind" NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculation_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"calculation_id" uuid NOT NULL,
	"snapshot_number" integer NOT NULL,
	"calculation_currency_id" uuid NOT NULL,
	"original_amount_minor" bigint NOT NULL,
	"fee_bps" bigint NOT NULL,
	"fee_amount_minor" bigint NOT NULL,
	"total_amount_minor" bigint NOT NULL,
	"base_currency_id" uuid NOT NULL,
	"fee_amount_in_base_minor" bigint NOT NULL,
	"total_in_base_minor" bigint NOT NULL,
	"additional_expenses_currency_id" uuid,
	"additional_expenses_amount_minor" bigint NOT NULL,
	"additional_expenses_in_base_minor" bigint NOT NULL,
	"total_with_expenses_in_base_minor" bigint NOT NULL,
	"rate_source" "calculation_rate_source" NOT NULL,
	"rate_num" bigint NOT NULL,
	"rate_den" bigint NOT NULL,
	"additional_expenses_rate_source" "calculation_rate_source",
	"additional_expenses_rate_num" bigint,
	"additional_expenses_rate_den" bigint,
	"calculation_timestamp" timestamp with time zone NOT NULL,
	"fx_quote_id" uuid,
	"quote_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calculation_snapshots_rate_positive_chk" CHECK ("calculation_snapshots"."rate_num" > 0 and "calculation_snapshots"."rate_den" > 0),
	CONSTRAINT "calculation_snapshots_additional_rate_shape_chk" CHECK ((
        "calculation_snapshots"."additional_expenses_rate_source" is null
        and "calculation_snapshots"."additional_expenses_rate_num" is null
        and "calculation_snapshots"."additional_expenses_rate_den" is null
      ) or (
        "calculation_snapshots"."additional_expenses_rate_source" is not null
        and "calculation_snapshots"."additional_expenses_rate_num" is not null
        and "calculation_snapshots"."additional_expenses_rate_den" is not null
        and "calculation_snapshots"."additional_expenses_rate_num" > 0
        and "calculation_snapshots"."additional_expenses_rate_den" > 0
      )),
	CONSTRAINT "calculation_snapshots_additional_rate_currency_chk" CHECK ((
        (
          "calculation_snapshots"."additional_expenses_currency_id" is null
          or "calculation_snapshots"."additional_expenses_currency_id" = "calculation_snapshots"."base_currency_id"
        )
        and "calculation_snapshots"."additional_expenses_rate_source" is null
        and "calculation_snapshots"."additional_expenses_rate_num" is null
        and "calculation_snapshots"."additional_expenses_rate_den" is null
      ) or (
        "calculation_snapshots"."additional_expenses_currency_id" is not null
        and "calculation_snapshots"."additional_expenses_currency_id" <> "calculation_snapshots"."base_currency_id"
      )),
	CONSTRAINT "calculation_snapshots_fx_quote_consistency_chk" CHECK ((
        "calculation_snapshots"."rate_source" = 'fx_quote'
        and "calculation_snapshots"."fx_quote_id" is not null
      ) or (
        "calculation_snapshots"."rate_source" <> 'fx_quote'
        and "calculation_snapshots"."fx_quote_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "calculations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"current_snapshot_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "counterparties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"customer_id" uuid,
	"relationship_kind" "counterparty_relationship_kind" DEFAULT 'external' NOT NULL,
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
CREATE TABLE "crm_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"assignee_user_id" text NOT NULL,
	"assigned_by_user_id" text NOT NULL,
	"deal_id" uuid,
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
CREATE TABLE "customer_bootstrap_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"normalized_inn" text NOT NULL,
	"normalized_kpp" text DEFAULT '' NOT NULL,
	"client_id" integer,
	"customer_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_counterparty_assignments" (
	"counterparty_id" uuid PRIMARY KEY NOT NULL,
	"sub_agent_counterparty_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
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
CREATE TABLE "deal_agent_bonuses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"commission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_approvals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"approval_type" "deal_approval_type" NOT NULL,
	"status" "deal_approval_status" NOT NULL,
	"requested_by" text,
	"decided_by" text,
	"comment" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deal_attachment_ingestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"status" "deal_attachment_ingestion_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"observed_revision" integer NOT NULL,
	"applied_revision" integer,
	"normalized_payload" jsonb DEFAULT null,
	"applied_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skipped_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_code" text,
	"error_message" text,
	"last_processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_calculation_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"calculation_id" uuid NOT NULL,
	"source_quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_capability_states" (
	"id" uuid PRIMARY KEY NOT NULL,
	"applicant_counterparty_id" uuid NOT NULL,
	"internal_entity_organization_id" uuid NOT NULL,
	"deal_type" "deal_type" NOT NULL,
	"capability_kind" "deal_capability_kind" NOT NULL,
	"status" "deal_capability_status" NOT NULL,
	"reason_code" text,
	"note" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_intake_snapshots" (
	"deal_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_leg_operation_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_leg_id" uuid NOT NULL,
	"treasury_operation_id" uuid NOT NULL,
	"operation_kind" "deal_leg_operation_kind" NOT NULL,
	"source_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_legs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"kind" "deal_leg_kind" NOT NULL,
	"state" "deal_leg_state" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_operational_positions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"kind" "deal_operational_position_kind" NOT NULL,
	"state" "deal_operational_position_state" NOT NULL,
	"amount_minor" bigint,
	"currency_id" uuid,
	"reason_code" text,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"role" "deal_participant_role" NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"counterparty_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_participants_exactly_one_fk_chk" CHECK ((
        "deal_participants"."customer_id" is not null
        and "deal_participants"."organization_id" is null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."customer_id" is null
        and "deal_participants"."organization_id" is not null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."customer_id" is null
        and "deal_participants"."organization_id" is null
        and "deal_participants"."counterparty_id" is not null
      )),
	CONSTRAINT "deal_participants_role_fk_match_chk" CHECK ((
        "deal_participants"."role" = 'customer'
        and "deal_participants"."customer_id" is not null
        and "deal_participants"."organization_id" is null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."role" = 'internal_entity'
        and "deal_participants"."organization_id" is not null
        and "deal_participants"."customer_id" is null
        and "deal_participants"."counterparty_id" is null
      ) or (
        "deal_participants"."role" in ('applicant', 'external_payer', 'external_beneficiary')
        and "deal_participants"."counterparty_id" is not null
        and "deal_participants"."customer_id" is null
        and "deal_participants"."organization_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "deal_quote_acceptances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"accepted_by_user_id" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deal_revision" integer NOT NULL,
	"agreement_version_id" uuid,
	"replaced_by_quote_id" uuid,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deal_timeline_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"type" "deal_timeline_event_type" NOT NULL,
	"visibility" "deal_timeline_visibility" DEFAULT 'internal' NOT NULL,
	"actor_user_id" text,
	"actor_label" text,
	"payload" jsonb NOT NULL,
	"source_ref" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"calculation_id" uuid,
	"type" "deal_type" NOT NULL,
	"status" "deal_status" DEFAULT 'draft' NOT NULL,
	"agent_id" text,
	"comment" text,
	"next_action" text,
	"source_amount_minor" bigint,
	"source_currency_id" uuid,
	"target_currency_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_business_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"deal_id" uuid,
	"link_kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_business_links_exactly_one_owner_chk" CHECK ("document_business_links"."deal_id" is not null)
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
	"organization_requisite_id" uuid,
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
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "documents_submission_status_chk" CHECK ("documents"."submission_status" in ('draft', 'submitted')),
	CONSTRAINT "documents_approval_status_chk" CHECK ("documents"."approval_status" in ('not_required', 'pending', 'approved', 'rejected')),
	CONSTRAINT "documents_posting_status_chk" CHECK ("documents"."posting_status" in ('not_required', 'unposted', 'posting', 'posted', 'failed')),
	CONSTRAINT "documents_lifecycle_status_chk" CHECK ("documents"."lifecycle_status" in ('active', 'cancelled')),
	CONSTRAINT "documents_submit_fields_chk" CHECK (("documents"."submission_status" = 'draft' and "documents"."submitted_by" is null and "documents"."submitted_at" is null) or ("documents"."submission_status" = 'submitted' and "documents"."submitted_at" is not null)),
	CONSTRAINT "documents_posting_requires_submission_chk" CHECK ("documents"."posting_status" in ('not_required', 'unposted') or "documents"."submission_status" = 'submitted'),
	CONSTRAINT "documents_posting_requires_approval_chk" CHECK ("documents"."posting_status" in ('not_required', 'unposted') or "documents"."approval_status" in ('not_required', 'approved')),
	CONSTRAINT "documents_cancelled_posting_status_chk" CHECK ("documents"."lifecycle_status" = 'active' or "documents"."posting_status" in ('unposted', 'failed'))
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
CREATE TABLE "file_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"current_version_id" uuid,
	"origin" "file_asset_origin" NOT NULL,
	"description" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"deal_id" uuid,
	"counterparty_id" uuid,
	"link_kind" "file_link_kind" NOT NULL,
	"attachment_purpose" "file_attachment_purpose",
	"attachment_visibility" "file_attachment_visibility",
	"generated_format" "file_generated_format",
	"generated_lang" "file_generated_lang",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_links_exactly_one_owner_chk" CHECK ((
        ("file_links"."deal_id" is not null and "file_links"."counterparty_id" is null)
        or ("file_links"."deal_id" is null and "file_links"."counterparty_id" is not null)
      )),
	CONSTRAINT "file_links_generated_variant_shape_chk" CHECK ((
        "file_links"."link_kind" in ('deal_attachment', 'legal_entity_attachment')
        and "file_links"."attachment_purpose" is not null
        and "file_links"."attachment_visibility" is not null
        and "file_links"."generated_format" is null
        and "file_links"."generated_lang" is null
      ) or (
        "file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract')
        and "file_links"."attachment_purpose" is null
        and "file_links"."attachment_visibility" is null
        and "file_links"."generated_format" is not null
        and "file_links"."generated_lang" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file_asset_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"checksum" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_versions_id_asset_uq" UNIQUE("id","file_asset_id")
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
CREATE TABLE "fx_quote_financial_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"bucket" text NOT NULL,
	"currency_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"source" text NOT NULL,
	"settlement_mode" text NOT NULL,
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
	"deal_id" uuid,
	"used_by_ref" text,
	"used_document_id" uuid,
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
CREATE TABLE "organization_requisite_bindings" (
	"requisite_id" uuid PRIMARY KEY NOT NULL,
	"book_id" uuid NOT NULL,
	"book_account_instance_id" uuid NOT NULL,
	"posting_account_no" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"short_name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text,
	"country" text,
	"kind" "party_kind" DEFAULT 'legal_entity' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"signature_key" text,
	"seal_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "party_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_legal_profile_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text,
	"country_code" "party_country_code",
	"jurisdiction_code" text,
	"postal_code" text,
	"city" text,
	"line_1" text,
	"line_2" text,
	"raw_text" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_legal_profile_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_legal_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_legal_profile_id" uuid NOT NULL,
	"scheme" text NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"jurisdiction_code" text,
	"issuer" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_legal_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"counterparty_id" uuid,
	"full_name" text NOT NULL,
	"short_name" text NOT NULL,
	"full_name_i18n" jsonb,
	"short_name_i18n" jsonb,
	"legal_form_code" text,
	"legal_form_label" text,
	"legal_form_label_i18n" jsonb,
	"country_code" "party_country_code",
	"jurisdiction_code" text,
	"registration_authority" text,
	"registered_at" timestamp with time zone,
	"business_activity_code" text,
	"business_activity_text" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_legal_profiles_owner_chk" CHECK ((
        "party_legal_profiles"."organization_id" is not null
        and "party_legal_profiles"."counterparty_id" is null
      ) or (
        "party_legal_profiles"."counterparty_id" is not null
        and "party_legal_profiles"."organization_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "party_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_legal_profile_id" uuid NOT NULL,
	"license_type" text NOT NULL,
	"license_number" text NOT NULL,
	"issued_by" text,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"activity_code" text,
	"activity_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_representatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"party_legal_profile_id" uuid NOT NULL,
	"role" text NOT NULL,
	"full_name" text NOT NULL,
	"full_name_i18n" jsonb,
	"title" text,
	"title_i18n" jsonb,
	"basis_document" text,
	"basis_document_i18n" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_access_grants" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'pending_onboarding' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
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
CREATE TABLE "requisite_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requisite_id" uuid NOT NULL,
	"scheme" text NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisite_provider_branch_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"scheme" text NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisite_provider_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"country" text,
	"jurisdiction_code" text,
	"postal_code" text,
	"city" text,
	"line_1" text,
	"line_2" text,
	"raw_address" text,
	"contact_email" text,
	"contact_phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisite_provider_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"scheme" text NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisite_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "requisite_kind" NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"country" text,
	"jurisdiction_code" text,
	"website" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "requisite_owner_type" NOT NULL,
	"organization_id" uuid,
	"counterparty_id" uuid,
	"provider_id" uuid NOT NULL,
	"provider_branch_id" uuid,
	"currency_id" uuid NOT NULL,
	"kind" "requisite_kind" NOT NULL,
	"label" text NOT NULL,
	"beneficiary_name" text,
	"beneficiary_name_local" text,
	"beneficiary_address" text,
	"payment_purpose_template" text,
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requisites_owner_fk_chk" CHECK ((
        "requisites"."owner_type" = 'organization'
        and "requisites"."organization_id" is not null
        and "requisites"."counterparty_id" is null
      ) or (
        "requisites"."owner_type" = 'counterparty'
        and "requisites"."counterparty_id" is not null
        and "requisites"."organization_id" is null
      ))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"audience" text NOT NULL,
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
CREATE TABLE "sub_agent_profiles" (
	"counterparty_id" uuid PRIMARY KEY NOT NULL,
	"commission_rate" numeric NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "treasury_instructions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"operation_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"state" text NOT NULL,
	"source_ref" text NOT NULL,
	"provider_ref" text,
	"provider_snapshot" jsonb DEFAULT 'null'::jsonb,
	"submitted_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"return_requested_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid,
	"customer_id" uuid,
	"internal_entity_organization_id" uuid,
	"kind" text NOT NULL,
	"state" text DEFAULT 'planned' NOT NULL,
	"source_ref" text NOT NULL,
	"quote_id" uuid,
	"amount_minor" bigint,
	"currency_id" uuid,
	"counter_amount_minor" bigint,
	"counter_currency_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
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
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_access_states" (
	"user_id" text PRIMARY KEY NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_close_packages" ADD CONSTRAINT "accounting_close_packages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_pack_assignments" ADD CONSTRAINT "accounting_pack_assignments_pack_checksum_accounting_pack_versions_checksum_fk" FOREIGN KEY ("pack_checksum") REFERENCES "public"."accounting_pack_versions"("checksum") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_period_locks" ADD CONSTRAINT "accounting_period_locks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_report_line_mappings" ADD CONSTRAINT "accounting_report_line_mappings_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_allowed_by_user_id_fk" FOREIGN KEY ("allowed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_fee_rules" ADD CONSTRAINT "agreement_fee_rules_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_fee_rules" ADD CONSTRAINT "agreement_fee_rules_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_parties" ADD CONSTRAINT "agreement_parties_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_parties" ADD CONSTRAINT "agreement_parties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_parties" ADD CONSTRAINT "agreement_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_organization_requisite_id_requisites_id_fk" FOREIGN KEY ("organization_requisite_id") REFERENCES "public"."requisites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_current_version_id_agreement_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_events" ADD CONSTRAINT "balance_events_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_events" ADD CONSTRAINT "balance_events_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_holds" ADD CONSTRAINT "balance_holds_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_positions" ADD CONSTRAINT "balance_positions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_account_instances" ADD CONSTRAINT "book_account_instances_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_calculation_snapshot_id_calculation_snapshots_id_fk" FOREIGN KEY ("calculation_snapshot_id") REFERENCES "public"."calculation_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_lines" ADD CONSTRAINT "calculation_lines_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_calculation_currency_id_currencies_id_fk" FOREIGN KEY ("calculation_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_base_currency_id_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_additional_expenses_currency_id_currencies_id_fk" FOREIGN KEY ("additional_expenses_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_fx_quote_id_fx_quotes_id_fk" FOREIGN KEY ("fx_quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculations" ADD CONSTRAINT "calculations_current_snapshot_id_calculation_snapshots_id_fk" FOREIGN KEY ("current_snapshot_id") REFERENCES "public"."calculation_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_account_dimension_policy" ADD CONSTRAINT "chart_account_dimension_policy_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_debit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("debit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_rules" ADD CONSTRAINT "correspondence_rules_credit_account_no_chart_template_accounts_account_no_fk" FOREIGN KEY ("credit_account_no") REFERENCES "public"."chart_template_accounts"("account_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparties" ADD CONSTRAINT "counterparties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_group_memberships" ADD CONSTRAINT "counterparty_group_memberships_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_group_memberships" ADD CONSTRAINT "counterparty_group_memberships_group_id_counterparty_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."counterparty_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_groups" ADD CONSTRAINT "counterparty_groups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_groups" ADD CONSTRAINT "counterparty_groups_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."counterparty_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_bootstrap_claims" ADD CONSTRAINT "customer_bootstrap_claims_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_bootstrap_claims" ADD CONSTRAINT "customer_bootstrap_claims_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_counterparty_assignments" ADD CONSTRAINT "customer_counterparty_assignments_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_counterparty_assignments" ADD CONSTRAINT "customer_counterparty_assignments_sub_agent_counterparty_id_counterparties_id_fk" FOREIGN KEY ("sub_agent_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_memberships" ADD CONSTRAINT "customer_memberships_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_memberships" ADD CONSTRAINT "customer_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_agent_bonuses" ADD CONSTRAINT "deal_agent_bonuses_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_agent_bonuses" ADD CONSTRAINT "deal_agent_bonuses_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_approvals" ADD CONSTRAINT "deal_approvals_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_attachment_ingestions" ADD CONSTRAINT "deal_attachment_ingestions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_calculation_links" ADD CONSTRAINT "deal_calculation_links_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_calculation_links" ADD CONSTRAINT "deal_calculation_links_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_capability_states" ADD CONSTRAINT "deal_capability_states_applicant_counterparty_id_counterparties_id_fk" FOREIGN KEY ("applicant_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_capability_states" ADD CONSTRAINT "deal_capability_states_internal_entity_organization_id_organizations_id_fk" FOREIGN KEY ("internal_entity_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_capability_states" ADD CONSTRAINT "deal_capability_states_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_intake_snapshots" ADD CONSTRAINT "deal_intake_snapshots_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_leg_operation_links" ADD CONSTRAINT "deal_leg_operation_links_deal_leg_id_deal_legs_id_fk" FOREIGN KEY ("deal_leg_id") REFERENCES "public"."deal_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_operational_positions" ADD CONSTRAINT "deal_operational_positions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_operational_positions" ADD CONSTRAINT "deal_operational_positions_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_participants" ADD CONSTRAINT "deal_participants_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_quote_acceptances" ADD CONSTRAINT "deal_quote_acceptances_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_quote_acceptances" ADD CONSTRAINT "deal_quote_acceptances_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_quote_acceptances" ADD CONSTRAINT "deal_quote_acceptances_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "public"."agreement_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_timeline_events" ADD CONSTRAINT "deal_timeline_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_timeline_events" ADD CONSTRAINT "deal_timeline_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_calculation_id_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_source_currency_id_currencies_id_fk" FOREIGN KEY ("source_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_target_currency_id_currencies_id_fk" FOREIGN KEY ("target_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_business_links" ADD CONSTRAINT "document_business_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_from_document_id_documents_id_fk" FOREIGN KEY ("from_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_to_document_id_documents_id_fk" FOREIGN KEY ("to_document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_snapshots" ADD CONSTRAINT "document_snapshots_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_requisite_id_requisites_id_fk" FOREIGN KEY ("organization_requisite_id") REFERENCES "public"."requisites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_current_version_belongs_to_asset_fk" FOREIGN KEY ("current_version_id","id") REFERENCES "public"."file_versions"("id","file_asset_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_links" ADD CONSTRAINT "file_links_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_fee_components" ADD CONSTRAINT "fx_quote_fee_components_rule_id_fee_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."fee_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_financial_lines" ADD CONSTRAINT "fx_quote_financial_lines_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_quote_legs" ADD CONSTRAINT "fx_quote_legs_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requisite_bindings" ADD CONSTRAINT "organization_requisite_bindings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requisite_bindings" ADD CONSTRAINT "organization_requisite_bindings_book_account_instance_id_book_account_instances_id_fk" FOREIGN KEY ("book_account_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_addresses" ADD CONSTRAINT "party_addresses_party_legal_profile_id_party_legal_profiles_id_fk" FOREIGN KEY ("party_legal_profile_id") REFERENCES "public"."party_legal_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_contacts" ADD CONSTRAINT "party_contacts_party_legal_profile_id_party_legal_profiles_id_fk" FOREIGN KEY ("party_legal_profile_id") REFERENCES "public"."party_legal_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_legal_identifiers" ADD CONSTRAINT "party_legal_identifiers_party_legal_profile_id_party_legal_profiles_id_fk" FOREIGN KEY ("party_legal_profile_id") REFERENCES "public"."party_legal_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_legal_profiles" ADD CONSTRAINT "party_legal_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_legal_profiles" ADD CONSTRAINT "party_legal_profiles_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_licenses" ADD CONSTRAINT "party_licenses_party_legal_profile_id_party_legal_profiles_id_fk" FOREIGN KEY ("party_legal_profile_id") REFERENCES "public"."party_legal_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_representatives" ADD CONSTRAINT "party_representatives_party_legal_profile_id_party_legal_profiles_id_fk" FOREIGN KEY ("party_legal_profile_id") REFERENCES "public"."party_legal_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_grants" ADD CONSTRAINT "portal_access_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_debit_instance_id_book_account_instances_id_fk" FOREIGN KEY ("debit_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_credit_instance_id_book_account_instances_id_fk" FOREIGN KEY ("credit_instance_id") REFERENCES "public"."book_account_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_external_record_id_reconciliation_external_records_id_fk" FOREIGN KEY ("external_record_id") REFERENCES "public"."reconciliation_external_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" ADD CONSTRAINT "reconciliation_exceptions_adjustment_document_id_documents_id_fk" FOREIGN KEY ("adjustment_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_external_record_id_reconciliation_external_records_id_fk" FOREIGN KEY ("external_record_id") REFERENCES "public"."reconciliation_external_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_operation_id_ledger_operations_id_fk" FOREIGN KEY ("matched_operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_matched_document_id_documents_id_fk" FOREIGN KEY ("matched_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisite_identifiers" ADD CONSTRAINT "requisite_identifiers_requisite_id_requisites_id_fk" FOREIGN KEY ("requisite_id") REFERENCES "public"."requisites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisite_provider_branch_identifiers" ADD CONSTRAINT "requisite_provider_branch_identifiers_branch_id_requisite_provider_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."requisite_provider_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisite_provider_branches" ADD CONSTRAINT "requisite_provider_branches_provider_id_requisite_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."requisite_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisite_provider_identifiers" ADD CONSTRAINT "requisite_provider_identifiers_provider_id_requisite_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."requisite_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisites" ADD CONSTRAINT "requisites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisites" ADD CONSTRAINT "requisites_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisites" ADD CONSTRAINT "requisites_provider_id_requisite_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."requisite_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisites" ADD CONSTRAINT "requisites_provider_branch_id_requisite_provider_branches_id_fk" FOREIGN KEY ("provider_branch_id") REFERENCES "public"."requisite_provider_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisites" ADD CONSTRAINT "requisites_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_agent_profiles" ADD CONSTRAINT "sub_agent_profiles_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_transfer_plans" ADD CONSTRAINT "tb_transfer_plans_operation_id_ledger_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ledger_operations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_instructions" ADD CONSTRAINT "treasury_instructions_operation_id_treasury_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."treasury_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_operations" ADD CONSTRAINT "treasury_operations_quote_id_fx_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_operations" ADD CONSTRAINT "treasury_operations_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_operations" ADD CONSTRAINT "treasury_operations_counter_currency_id_currencies_id_fk" FOREIGN KEY ("counter_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_states" ADD CONSTRAINT "user_access_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_close_packages_period_revision_uq" ON "accounting_close_packages" USING btree ("organization_id","period_start","revision");--> statement-breakpoint
CREATE INDEX "accounting_close_packages_lookup_idx" ON "accounting_close_packages" USING btree ("organization_id","period_start","revision");--> statement-breakpoint
CREATE INDEX "accounting_close_packages_state_idx" ON "accounting_close_packages" USING btree ("state","generated_at");--> statement-breakpoint
CREATE INDEX "accounting_pack_assignments_scope_effective_idx" ON "accounting_pack_assignments" USING btree ("scope_type","scope_id","effective_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_pack_versions_pack_version_uq" ON "accounting_pack_versions" USING btree ("pack_key","version");--> statement-breakpoint
CREATE INDEX "accounting_pack_versions_pack_compiled_idx" ON "accounting_pack_versions" USING btree ("pack_key","compiled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_period_locks_organization_period_uq" ON "accounting_period_locks" USING btree ("organization_id","period_start");--> statement-breakpoint
CREATE INDEX "accounting_period_locks_state_period_idx" ON "accounting_period_locks" USING btree ("state","period_start" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "accounting_period_locks_organization_state_idx" ON "accounting_period_locks" USING btree ("organization_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_report_line_mappings_uq" ON "accounting_report_line_mappings" USING btree ("standard","report_kind","line_code","account_no","effective_from");--> statement-breakpoint
CREATE INDEX "accounting_report_line_mappings_lookup_idx" ON "accounting_report_line_mappings" USING btree ("report_kind","account_no","effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "action_receipts_scope_key_uq" ON "action_receipts" USING btree ("scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "action_receipts_scope_created_idx" ON "action_receipts" USING btree ("scope","created_at");--> statement-breakpoint
CREATE INDEX "agent_profiles_status_idx" ON "agent_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_profiles_is_allowed_idx" ON "agent_profiles" USING btree ("is_allowed");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_fee_rules_version_kind_uq" ON "agreement_fee_rules" USING btree ("agreement_version_id","kind");--> statement-breakpoint
CREATE INDEX "agreement_fee_rules_version_idx" ON "agreement_fee_rules" USING btree ("agreement_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_parties_version_role_uq" ON "agreement_parties" USING btree ("agreement_version_id","party_role");--> statement-breakpoint
CREATE INDEX "agreement_parties_version_idx" ON "agreement_parties" USING btree ("agreement_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_versions_agreement_version_uq" ON "agreement_versions" USING btree ("agreement_id","version_number");--> statement-breakpoint
CREATE INDEX "agreement_versions_agreement_idx" ON "agreement_versions" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "agreements_customer_idx" ON "agreements" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "agreements_organization_idx" ON "agreements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agreements_current_version_idx" ON "agreements" USING btree ("current_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_active_customer_uq" ON "agreements" USING btree ("customer_id") WHERE "agreements"."is_active" = true;--> statement-breakpoint
CREATE INDEX "balance_events_subject_created_idx" ON "balance_events" USING btree ("book_id","subject_type","subject_id","currency","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_events_operation_subject_uq" ON "balance_events" USING btree ("operation_id","subject_type","subject_id","currency","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_holds_subject_ref_uq" ON "balance_holds" USING btree ("book_id","subject_type","subject_id","currency","hold_ref");--> statement-breakpoint
CREATE INDEX "balance_holds_state_created_idx" ON "balance_holds" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_positions_subject_uq" ON "balance_positions" USING btree ("book_id","subject_type","subject_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "book_account_instances_uq" ON "book_account_instances" USING btree ("book_id","account_no","currency","dimensions_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "book_account_instances_tb_uq" ON "book_account_instances" USING btree ("book_id","tb_ledger","tb_account_id");--> statement-breakpoint
CREATE INDEX "book_account_instances_book_currency_idx" ON "book_account_instances" USING btree ("book_id","currency");--> statement-breakpoint
CREATE INDEX "book_account_instances_account_no_idx" ON "book_account_instances" USING btree ("account_no");--> statement-breakpoint
CREATE UNIQUE INDEX "books_code_uq" ON "books" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "books_default_owner_uq" ON "books" USING btree ("owner_id") WHERE "books"."is_default" = true;--> statement-breakpoint
CREATE INDEX "books_owner_idx" ON "books" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "books_owner_default_idx" ON "books" USING btree ("owner_id","is_default");--> statement-breakpoint
CREATE UNIQUE INDEX "calculation_lines_snapshot_idx_uq" ON "calculation_lines" USING btree ("calculation_snapshot_id","idx");--> statement-breakpoint
CREATE INDEX "calculation_lines_snapshot_idx" ON "calculation_lines" USING btree ("calculation_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calculation_snapshots_calc_snapshot_uq" ON "calculation_snapshots" USING btree ("calculation_id","snapshot_number");--> statement-breakpoint
CREATE INDEX "calculation_snapshots_calc_idx" ON "calculation_snapshots" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "calculation_snapshots_fx_quote_idx" ON "calculation_snapshots" USING btree ("fx_quote_id");--> statement-breakpoint
CREATE INDEX "calculations_current_snapshot_idx" ON "calculations" USING btree ("current_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calculations_current_snapshot_uq" ON "calculations" USING btree ("current_snapshot_id") WHERE "calculations"."current_snapshot_id" is not null;--> statement-breakpoint
CREATE INDEX "chart_template_parent_idx" ON "chart_template_accounts" USING btree ("parent_account_no");--> statement-breakpoint
CREATE UNIQUE INDEX "correspondence_rule_uq" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no");--> statement-breakpoint
CREATE INDEX "correspondence_rule_lookup_idx" ON "correspondence_rules" USING btree ("posting_code","debit_account_no","credit_account_no","enabled");--> statement-breakpoint
CREATE INDEX "counterparty_group_memberships_group_idx" ON "counterparty_group_memberships" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counterparty_groups_code_uq" ON "counterparty_groups" USING btree ("code");--> statement-breakpoint
CREATE INDEX "counterparty_groups_parent_idx" ON "counterparty_groups" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "crm_tasks_assignee_sort_idx" ON "crm_tasks" USING btree ("assignee_user_id","sort_order");--> statement-breakpoint
CREATE INDEX "crm_tasks_due_date_idx" ON "crm_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "crm_tasks_completed_idx" ON "crm_tasks" USING btree ("completed");--> statement-breakpoint
CREATE INDEX "crm_tasks_deal_idx" ON "crm_tasks" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_code_uq" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "customer_bootstrap_claims_user_id_idx" ON "customer_bootstrap_claims" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_bootstrap_claims_user_inn_kpp_idx" ON "customer_bootstrap_claims" USING btree ("user_id","normalized_inn","normalized_kpp");--> statement-breakpoint
CREATE INDEX "customer_counterparty_assignments_sub_agent_idx" ON "customer_counterparty_assignments" USING btree ("sub_agent_counterparty_id");--> statement-breakpoint
CREATE INDEX "customer_memberships_user_id_idx" ON "customer_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_memberships_customer_user_idx" ON "customer_memberships" USING btree ("customer_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_agent_bonuses_deal_agent_uq" ON "deal_agent_bonuses" USING btree ("deal_id","agent_id");--> statement-breakpoint
CREATE INDEX "deal_agent_bonuses_deal_idx" ON "deal_agent_bonuses" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_agent_bonuses_agent_idx" ON "deal_agent_bonuses" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "deal_approvals_deal_requested_idx" ON "deal_approvals" USING btree ("deal_id","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_attachment_ingestions_file_asset_uq" ON "deal_attachment_ingestions" USING btree ("file_asset_id");--> statement-breakpoint
CREATE INDEX "deal_attachment_ingestions_deal_idx" ON "deal_attachment_ingestions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_attachment_ingestions_status_idx" ON "deal_attachment_ingestions" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_calculation_links_deal_calc_uq" ON "deal_calculation_links" USING btree ("deal_id","calculation_id");--> statement-breakpoint
CREATE INDEX "deal_calculation_links_deal_idx" ON "deal_calculation_links" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_calculation_links_calculation_idx" ON "deal_calculation_links" USING btree ("calculation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_capability_states_scope_uq" ON "deal_capability_states" USING btree ("applicant_counterparty_id","internal_entity_organization_id","deal_type","capability_kind");--> statement-breakpoint
CREATE INDEX "deal_capability_states_applicant_idx" ON "deal_capability_states" USING btree ("applicant_counterparty_id");--> statement-breakpoint
CREATE INDEX "deal_capability_states_internal_entity_idx" ON "deal_capability_states" USING btree ("internal_entity_organization_id");--> statement-breakpoint
CREATE INDEX "deal_capability_states_status_idx" ON "deal_capability_states" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_revision_idx" ON "deal_intake_snapshots" USING btree ("revision");--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_applicant_idx" ON "deal_intake_snapshots" USING btree (((snapshot -> 'common' ->> 'applicantCounterpartyId')));--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_invoice_idx" ON "deal_intake_snapshots" USING btree (((snapshot -> 'incomingReceipt' ->> 'invoiceNumber')));--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_contract_idx" ON "deal_intake_snapshots" USING btree (((snapshot -> 'incomingReceipt' ->> 'contractNumber')));--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_requested_execution_idx" ON "deal_intake_snapshots" USING btree (((snapshot -> 'common' ->> 'requestedExecutionDate')));--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_expected_at_idx" ON "deal_intake_snapshots" USING btree (((snapshot -> 'incomingReceipt' ->> 'expectedAt')));--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_payer_idx" ON "deal_intake_snapshots" USING btree (((snapshot -> 'incomingReceipt' ->> 'payerCounterpartyId')));--> statement-breakpoint
CREATE INDEX "deal_intake_snapshots_beneficiary_idx" ON "deal_intake_snapshots" USING btree (((snapshot -> 'externalBeneficiary' ->> 'beneficiaryCounterpartyId')));--> statement-breakpoint
CREATE UNIQUE INDEX "deal_leg_operation_links_source_ref_uq" ON "deal_leg_operation_links" USING btree ("source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_leg_operation_links_leg_operation_uq" ON "deal_leg_operation_links" USING btree ("deal_leg_id","treasury_operation_id");--> statement-breakpoint
CREATE INDEX "deal_leg_operation_links_leg_idx" ON "deal_leg_operation_links" USING btree ("deal_leg_id");--> statement-breakpoint
CREATE INDEX "deal_leg_operation_links_operation_idx" ON "deal_leg_operation_links" USING btree ("treasury_operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_legs_deal_idx_uq" ON "deal_legs" USING btree ("deal_id","idx");--> statement-breakpoint
CREATE INDEX "deal_legs_deal_idx" ON "deal_legs" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_operational_positions_deal_kind_uq" ON "deal_operational_positions" USING btree ("deal_id","kind");--> statement-breakpoint
CREATE INDEX "deal_operational_positions_deal_idx" ON "deal_operational_positions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_operational_positions_state_idx" ON "deal_operational_positions" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_participants_deal_role_uq" ON "deal_participants" USING btree ("deal_id","role");--> statement-breakpoint
CREATE INDEX "deal_participants_deal_idx" ON "deal_participants" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_quote_acceptances_deal_idx" ON "deal_quote_acceptances" USING btree ("deal_id","accepted_at");--> statement-breakpoint
CREATE INDEX "deal_quote_acceptances_quote_idx" ON "deal_quote_acceptances" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_quote_acceptances_deal_quote_uq" ON "deal_quote_acceptances" USING btree ("deal_id","quote_id");--> statement-breakpoint
CREATE INDEX "deal_timeline_events_deal_occurred_idx" ON "deal_timeline_events" USING btree ("deal_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_timeline_events_deal_source_ref_uq" ON "deal_timeline_events" USING btree ("deal_id","source_ref");--> statement-breakpoint
CREATE INDEX "deals_customer_idx" ON "deals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "deals_agreement_idx" ON "deals" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "deals_calculation_idx" ON "deals" USING btree ("calculation_id");--> statement-breakpoint
CREATE INDEX "deals_agent_idx" ON "deals" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deals_type_idx" ON "deals" USING btree ("type");--> statement-breakpoint
CREATE INDEX "deals_source_currency_idx" ON "deals" USING btree ("source_currency_id");--> statement-breakpoint
CREATE INDEX "deals_target_currency_idx" ON "deals" USING btree ("target_currency_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_business_links_document_uq" ON "document_business_links" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_business_links_document_deal_kind_uq" ON "document_business_links" USING btree ("document_id","deal_id","link_kind");--> statement-breakpoint
CREATE INDEX "document_business_links_deal_idx" ON "document_business_links" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "document_business_links_document_idx" ON "document_business_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_events_document_created_idx" ON "document_events" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_links_from_type_idx" ON "document_links" USING btree ("from_document_id","link_type");--> statement-breakpoint
CREATE INDEX "document_links_to_type_idx" ON "document_links" USING btree ("to_document_id","link_type");--> statement-breakpoint
CREATE UNIQUE INDEX "document_links_unique_idx" ON "document_links" USING btree ("from_document_id","to_document_id","link_type","role");--> statement-breakpoint
CREATE UNIQUE INDEX "document_operations_document_kind_uq" ON "document_operations" USING btree ("document_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "document_operations_operation_uq" ON "document_operations" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "document_operations_document_idx" ON "document_operations" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_snapshots_document_uq" ON "document_snapshots" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_snapshots_created_idx" ON "document_snapshots" USING btree ("created_at");--> statement-breakpoint
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
CREATE INDEX "documents_organization_requisite_idx" ON "documents" USING btree ("organization_requisite_id");--> statement-breakpoint
CREATE INDEX "documents_payload_gin_idx" ON "documents" USING gin ("payload");--> statement-breakpoint
CREATE INDEX "fee_rules_op_active_priority_idx" ON "fee_rules" USING btree ("operation_kind","is_active","priority");--> statement-breakpoint
CREATE INDEX "fee_rules_effective_idx" ON "fee_rules" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_current_version_uq" ON "file_assets" USING btree ("current_version_id") WHERE "file_assets"."current_version_id" is not null;--> statement-breakpoint
CREATE INDEX "file_assets_current_version_idx" ON "file_assets" USING btree ("current_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_asset_uq" ON "file_links" USING btree ("file_asset_id");--> statement-breakpoint
CREATE INDEX "file_links_deal_idx" ON "file_links" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "file_links_counterparty_idx" ON "file_links" USING btree ("counterparty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_generated_deal_variant_uq" ON "file_links" USING btree ("deal_id","link_kind","generated_format","generated_lang") WHERE "file_links"."deal_id" is not null and "file_links"."link_kind" in ('deal_application', 'deal_invoice', 'deal_acceptance');--> statement-breakpoint
CREATE UNIQUE INDEX "file_links_generated_counterparty_variant_uq" ON "file_links" USING btree ("counterparty_id","link_kind","generated_format","generated_lang") WHERE "file_links"."counterparty_id" is not null and "file_links"."link_kind" = 'legal_entity_contract';--> statement-breakpoint
CREATE UNIQUE INDEX "file_versions_asset_version_uq" ON "file_versions" USING btree ("file_asset_id","version_number");--> statement-breakpoint
CREATE INDEX "file_versions_asset_idx" ON "file_versions" USING btree ("file_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_fee_components_quote_idx_uq" ON "fx_quote_fee_components" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_fee_components_quote_id_idx" ON "fx_quote_fee_components" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_financial_lines_quote_idx_uq" ON "fx_quote_financial_lines" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_financial_lines_quote_id_idx" ON "fx_quote_financial_lines" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quote_legs_quote_idx_uq" ON "fx_quote_legs" USING btree ("quote_id","idx");--> statement-breakpoint
CREATE INDEX "fx_quote_legs_quote_idx" ON "fx_quote_legs" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_quotes_idem_uq" ON "fx_quotes" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "fx_quotes_deal_created_idx" ON "fx_quotes" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "fx_quotes_status_idx" ON "fx_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fx_quotes_expires_idx" ON "fx_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "fx_quotes_used_document_idx" ON "fx_quotes" USING btree ("used_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_source_pair_asof_uq" ON "fx_rates" USING btree ("source","base_currency_id","quote_currency_id","as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_pair_asof_idx" ON "fx_rates" USING btree ("base_currency_id","quote_currency_id","as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_asof_idx" ON "fx_rates" USING btree ("as_of");--> statement-breakpoint
CREATE INDEX "fx_rates_source_asof_idx" ON "fx_rates" USING btree ("source","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_operations_idem_uq" ON "ledger_operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_operations_status_idx" ON "ledger_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ledger_operations_source_idx" ON "ledger_operations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "requisite_accounting_bindings_book_idx" ON "organization_requisite_bindings" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "requisite_accounting_bindings_instance_idx" ON "organization_requisite_bindings" USING btree ("book_account_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_kind_ref_uq" ON "outbox" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "outbox_claim_idx" ON "outbox" USING btree ("kind","status","available_at","created_at") WHERE "outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_processing_lease_idx" ON "outbox" USING btree ("kind","status","locked_at") WHERE "outbox"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "outbox_status_avail_idx" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "party_addresses_profile_idx" ON "party_addresses" USING btree ("party_legal_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_addresses_primary_uq" ON "party_addresses" USING btree ("party_legal_profile_id","type") WHERE "party_addresses"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "party_contacts_profile_idx" ON "party_contacts" USING btree ("party_legal_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_contacts_primary_uq" ON "party_contacts" USING btree ("party_legal_profile_id","type") WHERE "party_contacts"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "party_legal_identifiers_profile_idx" ON "party_legal_identifiers" USING btree ("party_legal_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_legal_identifiers_value_uq" ON "party_legal_identifiers" USING btree ("party_legal_profile_id","scheme","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "party_legal_identifiers_primary_uq" ON "party_legal_identifiers" USING btree ("party_legal_profile_id","scheme") WHERE "party_legal_identifiers"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "party_legal_profiles_organization_uq" ON "party_legal_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_legal_profiles_counterparty_uq" ON "party_legal_profiles" USING btree ("counterparty_id");--> statement-breakpoint
CREATE INDEX "party_licenses_profile_idx" ON "party_licenses" USING btree ("party_legal_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_licenses_value_uq" ON "party_licenses" USING btree ("party_legal_profile_id","license_type","license_number");--> statement-breakpoint
CREATE INDEX "party_representatives_profile_idx" ON "party_representatives" USING btree ("party_legal_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "party_representatives_primary_uq" ON "party_representatives" USING btree ("party_legal_profile_id","role") WHERE "party_representatives"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "portal_access_grants_status_idx" ON "portal_access_grants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "portal_access_grants_user_id_idx" ON "portal_access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_access_grants_user_id_unique" ON "portal_access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "postings_op_line_uq" ON "postings" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "postings_op_idx" ON "postings" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "postings_book_currency_idx" ON "postings" USING btree ("book_id","currency");--> statement-breakpoint
CREATE INDEX "recon_exceptions_run_idx" ON "reconciliation_exceptions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "recon_exceptions_state_created_idx" ON "reconciliation_exceptions" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recon_external_records_source_id_uq" ON "reconciliation_external_records" USING btree ("source","source_record_id");--> statement-breakpoint
CREATE INDEX "recon_external_records_source_received_idx" ON "reconciliation_external_records" USING btree ("source","received_at");--> statement-breakpoint
CREATE INDEX "recon_matches_run_idx" ON "reconciliation_matches" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "recon_matches_external_record_idx" ON "reconciliation_matches" USING btree ("external_record_id");--> statement-breakpoint
CREATE INDEX "recon_matches_matched_operation_idx" ON "reconciliation_matches" USING btree ("matched_operation_id");--> statement-breakpoint
CREATE INDEX "recon_runs_source_created_idx" ON "reconciliation_runs" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "requisite_identifiers_requisite_idx" ON "requisite_identifiers" USING btree ("requisite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requisite_identifiers_value_uq" ON "requisite_identifiers" USING btree ("requisite_id","scheme","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "requisite_identifiers_primary_uq" ON "requisite_identifiers" USING btree ("requisite_id","scheme") WHERE "requisite_identifiers"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "requisite_provider_branch_identifiers_branch_idx" ON "requisite_provider_branch_identifiers" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requisite_provider_branch_identifiers_value_uq" ON "requisite_provider_branch_identifiers" USING btree ("branch_id","scheme","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "requisite_provider_branch_identifiers_primary_uq" ON "requisite_provider_branch_identifiers" USING btree ("branch_id","scheme") WHERE "requisite_provider_branch_identifiers"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "requisite_provider_branches_provider_idx" ON "requisite_provider_branches" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requisite_provider_branches_primary_uq" ON "requisite_provider_branches" USING btree ("provider_id") WHERE "requisite_provider_branches"."is_primary" = true and "requisite_provider_branches"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "requisite_provider_identifiers_provider_idx" ON "requisite_provider_identifiers" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requisite_provider_identifiers_value_uq" ON "requisite_provider_identifiers" USING btree ("provider_id","scheme","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "requisite_provider_identifiers_primary_uq" ON "requisite_provider_identifiers" USING btree ("provider_id","scheme") WHERE "requisite_provider_identifiers"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "requisite_providers_kind_idx" ON "requisite_providers" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "requisite_providers_country_idx" ON "requisite_providers" USING btree ("country");--> statement-breakpoint
CREATE INDEX "requisites_owner_type_idx" ON "requisites" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "requisites_organization_idx" ON "requisites" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "requisites_counterparty_idx" ON "requisites" USING btree ("counterparty_id");--> statement-breakpoint
CREATE INDEX "requisites_provider_idx" ON "requisites" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "requisites_provider_branch_idx" ON "requisites" USING btree ("provider_branch_id");--> statement-breakpoint
CREATE INDEX "requisites_currency_idx" ON "requisites" USING btree ("currency_id");--> statement-breakpoint
CREATE INDEX "requisites_kind_idx" ON "requisites" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "requisites_default_organization_uq" ON "requisites" USING btree ("organization_id","currency_id") WHERE "requisites"."owner_type" = 'organization' and "requisites"."is_default" = true and "requisites"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "requisites_default_counterparty_uq" ON "requisites" USING btree ("counterparty_id","currency_id") WHERE "requisites"."owner_type" = 'counterparty' and "requisites"."is_default" = true and "requisites"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_operation_line_uq" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE UNIQUE INDEX "tb_plan_transfer_uq" ON "tb_transfer_plans" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "tb_plan_post_idx" ON "tb_transfer_plans" USING btree ("operation_id","line_no");--> statement-breakpoint
CREATE INDEX "tb_plan_status_idx" ON "tb_transfer_plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_instructions_source_ref_uq" ON "treasury_instructions" USING btree ("source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_instructions_operation_attempt_uq" ON "treasury_instructions" USING btree ("operation_id","attempt");--> statement-breakpoint
CREATE INDEX "treasury_instructions_operation_idx" ON "treasury_instructions" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "treasury_instructions_state_idx" ON "treasury_instructions" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_operations_source_ref_uq" ON "treasury_operations" USING btree ("source_ref");--> statement-breakpoint
CREATE INDEX "treasury_operations_deal_idx" ON "treasury_operations" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "treasury_operations_customer_idx" ON "treasury_operations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "treasury_operations_internal_entity_idx" ON "treasury_operations" USING btree ("internal_entity_organization_id");--> statement-breakpoint
CREATE INDEX "treasury_operations_kind_idx" ON "treasury_operations" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "treasury_operations_quote_idx" ON "treasury_operations" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "two_factor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_access_states_banned_idx" ON "user_access_states" USING btree ("banned");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");