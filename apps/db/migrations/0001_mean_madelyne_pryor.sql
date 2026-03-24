CREATE TYPE "public"."ops_activity_action" AS ENUM('create', 'update', 'delete', 'status_change', 'comment', 'upload_document');--> statement-breakpoint
CREATE TYPE "public"."ops_activity_entity" AS ENUM('application', 'deal', 'client', 'calculation', 'contract', 'todo', 'document');--> statement-breakpoint
CREATE TYPE "public"."ops_activity_source" AS ENUM('web', 'bot');--> statement-breakpoint
CREATE TYPE "public"."ops_application_status" AS ENUM('forming', 'created', 'rejected', 'finished');--> statement-breakpoint
CREATE TYPE "public"."ops_deal_status" AS ENUM('preparing_documents', 'awaiting_funds', 'awaiting_payment', 'closing_documents', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "ops_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" integer NOT NULL,
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
CREATE TABLE "ops_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" "ops_activity_action" NOT NULL,
	"entity_type" "ops_activity_entity" NOT NULL,
	"entity_id" integer NOT NULL,
	"entity_title" text,
	"source" "ops_activity_source" DEFAULT 'web' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_agent_bonus" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"deal_id" integer NOT NULL,
	"commission" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_agent_organization_bank_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text,
	"name_i18n" jsonb,
	"bank_name" text,
	"bank_name_i18n" jsonb,
	"bank_address" text,
	"bank_address_i18n" jsonb,
	"account" text,
	"bic" text,
	"corr_account" text,
	"swift_code" text,
	"currency_code" text DEFAULT 'RUB' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"requisite_id" uuid,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_agent_organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"name_i18n" jsonb,
	"org_type" text,
	"org_type_i18n" jsonb,
	"country" text,
	"country_i18n" jsonb,
	"city" text,
	"city_i18n" jsonb,
	"address" text,
	"address_i18n" jsonb,
	"inn" text,
	"tax_id" text,
	"kpp" text,
	"ogrn" text,
	"oktmo" text,
	"okpo" text,
	"director_name" text,
	"director_name_i18n" jsonb,
	"director_position" text,
	"director_position_i18n" jsonb,
	"director_basis" text,
	"director_basis_i18n" jsonb,
	"signature_key" text,
	"seal_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"organization_id" uuid,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tg_id" bigint,
	"user_name" text,
	"name" text NOT NULL,
	"tag" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_allowed" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"allowed_by" bigint,
	"allowed_at" text,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"bedrock_user_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ops_agents_tg_id_unique" UNIQUE("tg_id"),
	CONSTRAINT "ops_agents_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ops_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"client_id" integer NOT NULL,
	"status" "ops_application_status" DEFAULT 'created' NOT NULL,
	"reason" text,
	"comment" text,
	"requested_amount" text,
	"requested_currency" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_calculations" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"currency_code" text NOT NULL,
	"original_amount" text NOT NULL,
	"fee_percentage" text NOT NULL,
	"fee_amount" text NOT NULL,
	"total_amount" text NOT NULL,
	"rate_source" text NOT NULL,
	"rate" text NOT NULL,
	"additional_expenses_currency_code" text,
	"additional_expenses" text NOT NULL,
	"base_currency_code" text DEFAULT 'RUB' NOT NULL,
	"fee_amount_in_base" text NOT NULL,
	"total_in_base" text NOT NULL,
	"additional_expenses_in_base" text NOT NULL,
	"total_with_expenses_in_base" text NOT NULL,
	"calculation_timestamp" text NOT NULL,
	"sent_to_client" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"fx_quote_id" uuid,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_client_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"s3_key" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"description" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_name" text NOT NULL,
	"org_name_i18n" jsonb,
	"org_type" text,
	"org_type_i18n" jsonb,
	"director_name" text,
	"director_name_i18n" jsonb,
	"position" text,
	"position_i18n" jsonb,
	"director_basis" text,
	"director_basis_i18n" jsonb,
	"address" text,
	"address_i18n" jsonb,
	"email" text,
	"phone" text,
	"inn" text,
	"kpp" text,
	"ogrn" text,
	"oktmo" text,
	"okpo" text,
	"bank_name" text,
	"bank_name_i18n" jsonb,
	"bank_address" text,
	"bank_address_i18n" jsonb,
	"account" text,
	"bic" text,
	"corr_account" text,
	"bank_country" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"contract_id" integer,
	"sub_agent_id" integer,
	"user_id" integer,
	"counterparty_id" uuid,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_number" text,
	"contract_date" text,
	"agent_fee" text,
	"fixed_fee" text,
	"client_id" integer NOT NULL,
	"agent_organization_id" integer NOT NULL,
	"agent_organization_bank_details_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ops_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "ops_deal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"s3_key" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"description" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"calculation_id" integer NOT NULL,
	"agent_organization_bank_details_id" integer NOT NULL,
	"status" "ops_deal_status" DEFAULT 'preparing_documents' NOT NULL,
	"invoice_number" text,
	"invoice_date" text,
	"company_name" text,
	"company_name_i18n" jsonb,
	"bank_name" text,
	"bank_name_i18n" jsonb,
	"account" text,
	"swift_code" text,
	"contract_date" text,
	"contract_number" text,
	"cost_price" text,
	"closed_at" text,
	"comment" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_s3_cleanup_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"s3_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" integer NOT NULL,
	CONSTRAINT "ops_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "ops_sub_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"commission" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_telegraf_sessions" (
	"key" varchar(32) PRIMARY KEY NOT NULL,
	"session" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"application_id" integer,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"due_date" text,
	"assigned_by" integer,
	"description" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops_accounts" ADD CONSTRAINT "ops_accounts_user_id_ops_agents_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ops_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_activity_log" ADD CONSTRAINT "ops_activity_log_user_id_ops_agents_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_agent_bonus" ADD CONSTRAINT "ops_agent_bonus_agent_id_ops_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_agent_bonus" ADD CONSTRAINT "ops_agent_bonus_deal_id_ops_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."ops_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_agent_organization_bank_details" ADD CONSTRAINT "ops_agent_organization_bank_details_organization_id_ops_agent_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."ops_agent_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_agent_organization_bank_details" ADD CONSTRAINT "ops_agent_organization_bank_details_requisite_id_requisites_id_fk" FOREIGN KEY ("requisite_id") REFERENCES "public"."requisites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_agent_organizations" ADD CONSTRAINT "ops_agent_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_agents" ADD CONSTRAINT "ops_agents_bedrock_user_id_user_id_fk" FOREIGN KEY ("bedrock_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_applications" ADD CONSTRAINT "ops_applications_agent_id_ops_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_applications" ADD CONSTRAINT "ops_applications_client_id_ops_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."ops_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_calculations" ADD CONSTRAINT "ops_calculations_application_id_ops_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ops_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_calculations" ADD CONSTRAINT "ops_calculations_fx_quote_id_fx_quotes_id_fk" FOREIGN KEY ("fx_quote_id") REFERENCES "public"."fx_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_client_documents" ADD CONSTRAINT "ops_client_documents_client_id_ops_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."ops_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_client_documents" ADD CONSTRAINT "ops_client_documents_uploaded_by_ops_agents_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_clients" ADD CONSTRAINT "ops_clients_contract_id_ops_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."ops_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_clients" ADD CONSTRAINT "ops_clients_sub_agent_id_ops_sub_agents_id_fk" FOREIGN KEY ("sub_agent_id") REFERENCES "public"."ops_sub_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_clients" ADD CONSTRAINT "ops_clients_user_id_ops_agents_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_clients" ADD CONSTRAINT "ops_clients_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_contracts" ADD CONSTRAINT "ops_contracts_agent_organization_id_ops_agent_organizations_id_fk" FOREIGN KEY ("agent_organization_id") REFERENCES "public"."ops_agent_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_contracts" ADD CONSTRAINT "ops_contracts_agent_organization_bank_details_id_ops_agent_organization_bank_details_id_fk" FOREIGN KEY ("agent_organization_bank_details_id") REFERENCES "public"."ops_agent_organization_bank_details"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deal_documents" ADD CONSTRAINT "ops_deal_documents_deal_id_ops_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."ops_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deal_documents" ADD CONSTRAINT "ops_deal_documents_uploaded_by_ops_agents_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_application_id_ops_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ops_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_calculation_id_ops_calculations_id_fk" FOREIGN KEY ("calculation_id") REFERENCES "public"."ops_calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_deals" ADD CONSTRAINT "ops_deals_agent_organization_bank_details_id_ops_agent_organization_bank_details_id_fk" FOREIGN KEY ("agent_organization_bank_details_id") REFERENCES "public"."ops_agent_organization_bank_details"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_sessions" ADD CONSTRAINT "ops_sessions_user_id_ops_agents_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ops_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_todos" ADD CONSTRAINT "ops_todos_agent_id_ops_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_todos" ADD CONSTRAINT "ops_todos_application_id_ops_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."ops_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_todos" ADD CONSTRAINT "ops_todos_assigned_by_ops_agents_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."ops_agents"("id") ON DELETE no action ON UPDATE no action;