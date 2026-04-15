CREATE TYPE "public"."deal_route_component_basis_type" AS ENUM('deal_source_amount', 'deal_target_amount', 'leg_from_amount', 'leg_to_amount', 'gross_revenue');--> statement-breakpoint
CREATE TYPE "public"."deal_route_component_classification" AS ENUM('revenue', 'expense', 'pass_through', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."deal_route_component_formula_type" AS ENUM('fixed', 'bps', 'per_million', 'manual');--> statement-breakpoint
CREATE TYPE "public"."deal_route_leg_kind" AS ENUM('collection', 'intracompany_transfer', 'intercompany_funding', 'fx_conversion', 'payout', 'return', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."deal_route_party_kind" AS ENUM('customer', 'counterparty', 'organization');--> statement-breakpoint
CREATE TYPE "public"."deal_route_template_participant_binding" AS ENUM('fixed_party', 'deal_customer', 'deal_applicant', 'deal_payer', 'deal_beneficiary');--> statement-breakpoint
CREATE TYPE "public"."deal_route_template_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "route_template_cost_components" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_template_id" uuid NOT NULL,
	"leg_id" uuid,
	"code" text NOT NULL,
	"family" text NOT NULL,
	"classification" "deal_route_component_classification" NOT NULL,
	"formula_type" "deal_route_component_formula_type" NOT NULL,
	"basis_type" "deal_route_component_basis_type" NOT NULL,
	"currency_id" uuid NOT NULL,
	"fixed_amount_minor" bigint,
	"bps" text,
	"per_million" text,
	"manual_amount_minor" bigint,
	"rounding_mode" text NOT NULL,
	"included_in_client_rate" boolean DEFAULT false NOT NULL,
	"sequence" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_template_legs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_template_id" uuid NOT NULL,
	"code" text NOT NULL,
	"idx" integer NOT NULL,
	"kind" "deal_route_leg_kind" NOT NULL,
	"from_participant_id" uuid NOT NULL,
	"to_participant_id" uuid NOT NULL,
	"from_currency_id" uuid NOT NULL,
	"to_currency_id" uuid NOT NULL,
	"expected_from_amount_minor" bigint,
	"expected_to_amount_minor" bigint,
	"expected_rate_num" bigint,
	"expected_rate_den" bigint,
	"settlement_model" text NOT NULL,
	"execution_counterparty_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_template_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_template_id" uuid NOT NULL,
	"code" text NOT NULL,
	"role" text NOT NULL,
	"binding_kind" "deal_route_template_participant_binding" NOT NULL,
	"party_kind" "deal_route_party_kind" NOT NULL,
	"customer_id" uuid,
	"organization_id" uuid,
	"counterparty_id" uuid,
	"requisite_id" uuid,
	"display_name_template" text,
	"sequence" integer NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_template_participants_fixed_party_fk_chk" CHECK ((
        "route_template_participants"."binding_kind" <> 'fixed_party'
        and "route_template_participants"."customer_id" is null
        and "route_template_participants"."organization_id" is null
        and "route_template_participants"."counterparty_id" is null
      ) or (
        "route_template_participants"."binding_kind" = 'fixed_party'
        and (
          ("route_template_participants"."customer_id" is not null and "route_template_participants"."organization_id" is null and "route_template_participants"."counterparty_id" is null)
          or ("route_template_participants"."customer_id" is null and "route_template_participants"."organization_id" is not null and "route_template_participants"."counterparty_id" is null)
          or ("route_template_participants"."customer_id" is null and "route_template_participants"."organization_id" is null and "route_template_participants"."counterparty_id" is not null)
        )
      )),
	CONSTRAINT "route_template_participants_fixed_party_kind_fk_match_chk" CHECK ((
        "route_template_participants"."binding_kind" <> 'fixed_party'
      ) or (
        "route_template_participants"."party_kind" = 'customer'
        and "route_template_participants"."customer_id" is not null
        and "route_template_participants"."organization_id" is null
        and "route_template_participants"."counterparty_id" is null
      ) or (
        "route_template_participants"."party_kind" = 'organization'
        and "route_template_participants"."organization_id" is not null
        and "route_template_participants"."customer_id" is null
        and "route_template_participants"."counterparty_id" is null
      ) or (
        "route_template_participants"."party_kind" = 'counterparty'
        and "route_template_participants"."counterparty_id" is not null
        and "route_template_participants"."customer_id" is null
        and "route_template_participants"."organization_id" is null
      )),
	CONSTRAINT "route_template_participants_binding_kind_party_kind_chk" CHECK ((
        "route_template_participants"."binding_kind" = 'fixed_party'
      ) or (
        "route_template_participants"."binding_kind" = 'deal_customer'
        and "route_template_participants"."party_kind" = 'customer'
      ) or (
        "route_template_participants"."binding_kind" in ('deal_applicant', 'deal_payer', 'deal_beneficiary')
        and "route_template_participants"."party_kind" = 'counterparty'
      ))
);
--> statement-breakpoint
CREATE TABLE "route_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"deal_type" "deal_type" NOT NULL,
	"description" text,
	"status" "deal_route_template_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "route_template_cost_components" ADD CONSTRAINT "route_template_cost_components_route_template_id_route_templates_id_fk" FOREIGN KEY ("route_template_id") REFERENCES "public"."route_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_cost_components" ADD CONSTRAINT "route_template_cost_components_leg_id_route_template_legs_id_fk" FOREIGN KEY ("leg_id") REFERENCES "public"."route_template_legs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_cost_components" ADD CONSTRAINT "route_template_cost_components_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_route_template_id_route_templates_id_fk" FOREIGN KEY ("route_template_id") REFERENCES "public"."route_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_from_participant_id_route_template_participants_id_fk" FOREIGN KEY ("from_participant_id") REFERENCES "public"."route_template_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_to_participant_id_route_template_participants_id_fk" FOREIGN KEY ("to_participant_id") REFERENCES "public"."route_template_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_from_currency_id_currencies_id_fk" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_to_currency_id_currencies_id_fk" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_legs" ADD CONSTRAINT "route_template_legs_execution_counterparty_id_counterparties_id_fk" FOREIGN KEY ("execution_counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_route_template_id_route_templates_id_fk" FOREIGN KEY ("route_template_id") REFERENCES "public"."route_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_counterparty_id_counterparties_id_fk" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_template_participants" ADD CONSTRAINT "route_template_participants_requisite_id_requisites_id_fk" FOREIGN KEY ("requisite_id") REFERENCES "public"."requisites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_cost_components_template_code_uq" ON "route_template_cost_components" USING btree ("route_template_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_cost_components_template_sequence_uq" ON "route_template_cost_components" USING btree ("route_template_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_legs_template_code_uq" ON "route_template_legs" USING btree ("route_template_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_legs_template_idx_uq" ON "route_template_legs" USING btree ("route_template_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_participants_template_code_uq" ON "route_template_participants" USING btree ("route_template_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "route_template_participants_template_sequence_uq" ON "route_template_participants" USING btree ("route_template_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "route_templates_code_uq" ON "route_templates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "route_templates_status_idx" ON "route_templates" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "route_templates_deal_type_idx" ON "route_templates" USING btree ("deal_type");